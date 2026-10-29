import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    hasRenderedContent,
    killServerGroup,
    launchProbeBrowser,
    measureInPage,
    parseProbeArgs,
    slugForPath,
    startedServerAnswers,
    waitForContent,
    waitForServer,
    withServer
} from './probe.mjs';
import { quietPort } from './quiet-ports.mjs';

describe('parseProbeArgs', () => {
    it('defaults to the root path and the three-width sweep', () => {
        expect(parseProbeArgs([])).toEqual({ path: '/', widths: [390, 768, 1440], useDev: false });
    });

    it('takes the path first and any widths after it', () => {
        expect(parseProbeArgs(['/en/example-form', '390', '1440'])).toEqual({
            path: '/en/example-form',
            widths: [390, 1440],
            useDev: false
        });
    });

    it('reads --dev from anywhere in the arguments without eating the path', () => {
        expect(parseProbeArgs(['--dev', '/en'])).toEqual({
            path: '/en',
            widths: [390, 768, 1440],
            useDev: true
        });
    });

    it('refuses a non-numeric width instead of silently probing one viewport', () => {
        // A NaN width would reach setViewportSize and throw somewhere far from the cause.
        expect(() => parseProbeArgs(['/en', 'wide'])).toThrow(/positive numbers/);
    });

    it('refuses a zero width', () => {
        expect(() => parseProbeArgs(['/en', '0'])).toThrow(/positive numbers/);
    });
});

describe('waitForServer', () => {
    /* Written after the first live run failed on ERR_CONNECTION_REFUSED: `page.goto` does not retry
       a refused connection, so a probe with no explicit wait dies before the server finishes
       booting — and the comment that claimed Playwright would retry was the actual defect. */
    it('returns as soon as the server answers', async () => {
        let calls = 0;
        const attempt = await waitForServer(
            () => {
                calls += 1;
                return Promise.resolve(calls === 3);
            },
            { attempts: 10, delayMs: 0 }
        );
        expect(attempt).toBe(3);
    });

    it('throws with a readable reason rather than probing a dead server forever', async () => {
        await expect(
            waitForServer(() => Promise.resolve(false), { attempts: 2, delayMs: 0 })
        ).rejects.toThrow(/never answered/);
    });
});

describe('waitForContent', () => {
    /* The SPA sibling reported "0 controls, 0 headings" on its first live run: `load` fires before
       the app mounts, so the probe measured an empty shell and printed it like data. These cases pin
       both halves — wait for content, and when none comes, SAY so rather than report zeros. */
    const empty = { controls: 0, headings: 0 };
    const mounted = { controls: 5, headings: 1 };

    it('returns as soon as content appears, without waiting out the attempts', async () => {
        let reads = 0;
        const result = await waitForContent(
            () => {
                reads += 1;
                return Promise.resolve(reads < 3 ? empty : mounted);
            },
            { attempts: 20, delayMs: 0 }
        );
        expect(result.rendered).toBe(true);
        expect(reads).toBe(3);
    });

    it('gives up and reports NOT rendered rather than passing an empty page off as a measurement', async () => {
        const result = await waitForContent(() => Promise.resolve(empty), {
            attempts: 3,
            delayMs: 0
        });
        expect(result.rendered).toBe(false);
        expect(result.measurement).toEqual(empty);
    });

    it('counts a heading-only page as rendered — not every route has a control', () => {
        expect(hasRenderedContent({ controls: 0, headings: 1 })).toBe(true);
        expect(hasRenderedContent({ controls: 1, headings: 0 })).toBe(true);
        expect(hasRenderedContent(empty)).toBe(false);
    });
});

describe('slugForPath', () => {
    it('turns a route into a scannable file stem', () => {
        expect(slugForPath('/en/example-form')).toBe('en-example-form');
    });

    it('keeps the root readable rather than empty', () => {
        expect(slugForPath('/')).toBe('root');
    });

    it('ignores a trailing slash so two spellings of one route share a file', () => {
        expect(slugForPath('/en/')).toBe('en');
    });
});

describe('measureInPage', () => {
    /* The function runs inside the browser, so these cases hand it a stub `document`. What is worth
       pinning is the ARITHMETIC: an overflow reported as a negative number, or a "smallest control"
       picked by width instead of height, is the class of defect that makes a probe reading quietly
       wrong while still looking like data. */
    // The jsdom environment exposes `document` as a getter-only global, so a plain assignment throws;
    // `vi.stubGlobal` redefines the property and `unstubAllGlobals` restores the original.
    const withDocument = (documentStub, run) => {
        vi.stubGlobal('document', documentStub);
        try {
            return run();
        } finally {
            vi.unstubAllGlobals();
        }
    };

    const rect = (width, height) => ({ getBoundingClientRect: () => ({ width, height }) });

    const stubDocument = ({ scrollWidth, clientWidth, controls = [], headings = 0 }) => ({
        documentElement: { scrollWidth, clientWidth },
        title: 'stub',
        querySelectorAll: (selector) =>
            selector.startsWith('h1') ? { length: headings } : controls
    });

    it('reports overflow as the positive difference, never a negative number', () => {
        const measurement = withDocument(
            stubDocument({ scrollWidth: 418, clientWidth: 390 }),
            measureInPage
        );
        expect(measurement.horizontalOverflowPx).toBe(28);
    });

    it('clamps a page narrower than its viewport to zero overflow', () => {
        const measurement = withDocument(
            stubDocument({ scrollWidth: 380, clientWidth: 390 }),
            measureInPage
        );
        expect(measurement.horizontalOverflowPx).toBe(0);
    });

    it('picks the SHORTEST control, because the touch floor is about height', () => {
        const measurement = withDocument(
            stubDocument({
                scrollWidth: 390,
                clientWidth: 390,
                controls: [rect(200, 48), rect(40, 40), rect(300, 56)]
            }),
            measureInPage
        );
        expect(measurement.smallestControl).toBe('40x40');
    });

    it('says "none" rather than crashing when every control measures zero', () => {
        const measurement = withDocument(
            stubDocument({ scrollWidth: 390, clientWidth: 390, controls: [rect(0, 0)] }),
            measureInPage
        );
        expect(measurement.smallestControl).toBe('none');
    });

    it('counts the controls it found, so a probe of an empty page is visibly empty', () => {
        const measurement = withDocument(
            stubDocument({ scrollWidth: 390, clientWidth: 390, controls: [], headings: 2 }),
            measureInPage
        );
        expect(measurement.controls).toBe(0);
        expect(measurement.headings).toBe(2);
    });
});

describe('launchProbeBrowser', () => {
    /* Playwright's headless Chromium starts with `--hide-scrollbars`, so a scrolling page measured
       under the default launch has no scrollbar at all. Measured on this repository's Chromium (390 px
       viewport, tall page, no `scrollbar-gutter`): 0 px with the default launch, 15 px once the flag is
       dropped. A desktop visitor on Windows or Linux has that 15 px. */
    it('launches Chromium without the flag that hides classic scrollbars', async () => {
        const launch = vi.fn(async () => 'browser');
        const browser = await launchProbeBrowser({ launch });

        expect(browser).toBe('browser');
        expect(launch).toHaveBeenCalledTimes(1);
        expect(launch.mock.calls[0][0]).toMatchObject({
            ignoreDefaultArgs: ['--hide-scrollbars']
        });
    });
});

/* The server the probe starts is `npm run dev`, which starts `next dev`, which starts workers. Three
   things went wrong with a bare `spawn` and `server.kill()`: the probe took port 3000 whether or not
   something already answered there and measured THAT server (another checkout's tree); a signal or a
   failed browser launch skipped the cleanup; and killing the npm wrapper left `next dev` listening.
   Nothing below starts a real server: the spawn, the port search and the process are injected. */
describe('withServer', () => {
    const PID = 4242;
    const fakeServer = (overrides = {}) => ({
        pid: PID,
        exitCode: null,
        signalCode: null,
        kill: vi.fn(),
        ...overrides
    });

    /* `findPort` is a stub that returns the base port unless the case hands one in; `realSearch`
       leaves it out, so the case meets the search `withServer` uses by default. */
    const setup = ({
        server = fakeServer(),
        findPort,
        realSearch = false,
        useDev = true,
        basePort = 3000
    } = {}) => {
        const spawnServer = vi.fn(() => server);
        const kill = vi.fn();
        const proc = Object.assign(new EventEmitter(), { exit: vi.fn() });
        const options = {
            useDev,
            basePort,
            environment: { KEEP: 'yes', PORT: 'stale' },
            spawnServer,
            proc,
            kill
        };
        if (!realSearch) {
            options.findPort = findPort ?? vi.fn((base) => Promise.resolve(base));
        }
        return { server, spawnServer, kill, proc, options };
    };

    const held = [];
    afterEach(async () => {
        for (const server of held.splice(0)) {
            await new Promise((resolveClose) => server.close(resolveClose));
        }
    });

    describe('the server it starts', () => {
        it('runs the dev server on the chosen port, in its own process group', async () => {
            const { options, spawnServer } = setup();

            await withServer(options, () => Promise.resolve());

            expect(spawnServer).toHaveBeenCalledExactlyOnceWith(
                'npm',
                ['run', 'dev', '--', '--port', '3000'],
                expect.objectContaining({ detached: true, shell: false, stdio: 'ignore' })
            );
            expect(spawnServer.mock.calls[0][2].env).toMatchObject({ KEEP: 'yes', PORT: '3000' });
        });

        it('runs the production server for a build', async () => {
            const { options, spawnServer } = setup({ useDev: false, basePort: 3100 });

            await withServer(options, () => Promise.resolve());

            expect(spawnServer.mock.calls[0][1]).toEqual(['run', 'start', '--', '--port', '3100']);
        });

        it('moves to the port the search returns when the base port is busy', async () => {
            const findPort = vi.fn(() => Promise.resolve(3007));
            const { options, spawnServer } = setup({ findPort });
            let seen;

            await withServer(options, ({ port }) => {
                seen = port;
                return Promise.resolve();
            });

            expect(findPort).toHaveBeenCalledExactlyOnceWith(3000);
            expect(spawnServer.mock.calls[0][1]).toEqual(['run', 'dev', '--', '--port', '3007']);
            expect(spawnServer.mock.calls[0][2].env.PORT).toBe('3007');
            expect(seen).toBe(3007);
        });

        it('by default steps past a port that a real socket holds', async () => {
            const base = quietPort('probe');
            const holder = createServer();
            held.push(holder);
            await new Promise((resolveListen) => holder.listen(base, resolveListen));
            const { options, spawnServer } = setup({ basePort: base, realSearch: true });

            await withServer(options, () => Promise.resolve());

            const port = Number(spawnServer.mock.calls[0][1].at(-1));
            expect(port).toBeGreaterThan(base);
            expect(port).toBeLessThanOrEqual(base + 20);
        });

        it('starts nothing, and hooks nothing, when no port is free', async () => {
            const findPort = vi.fn(() => Promise.reject(new Error('No free port within 20')));
            const { options, spawnServer, proc } = setup({ findPort });

            await expect(withServer(options, () => Promise.resolve())).rejects.toThrow(
                /No free port/
            );

            expect(spawnServer).not.toHaveBeenCalled();
            expect(proc.listenerCount('SIGINT')).toBe(0);
        });
    });

    describe('stopping it', () => {
        it('signals the whole group, not the wrapper, when the body succeeds', async () => {
            const { options, kill } = setup();

            await withServer(options, () => Promise.resolve());

            expect(kill).toHaveBeenCalledExactlyOnceWith(-PID, 'SIGTERM');
        });

        it('signals the group when the body fails, and lets the failure through', async () => {
            const { options, kill } = setup();

            await expect(
                withServer(options, () => Promise.reject(new Error('browser did not launch')))
            ).rejects.toThrow('browser did not launch');

            expect(kill).toHaveBeenCalledExactlyOnceWith(-PID, 'SIGTERM');
        });

        /* SIGHUP is a closed terminal: the detached server is not in the terminal's session, so it
           would be the one process left running. */
        it.each([
            ['SIGINT', 130],
            ['SIGTERM', 143],
            ['SIGHUP', 129]
        ])('signals the group on %s and exits with %i', async (signal, code) => {
            const { options, kill, proc } = setup();

            await withServer(options, () => {
                proc.emit(signal);
                return Promise.resolve();
            });

            expect(kill).toHaveBeenCalledWith(-PID, 'SIGTERM');
            expect(proc.exit).toHaveBeenCalledExactlyOnceWith(code);
        });

        it('signals the group on any other way out of the process', async () => {
            const { options, kill, proc } = setup();

            await withServer(options, () => {
                proc.emit('exit');
                return Promise.resolve();
            });

            expect(kill).toHaveBeenCalledWith(-PID, 'SIGTERM');
        });

        it('is listening for the signals while the body runs, and only then', async () => {
            const { options, proc } = setup();
            const during = {};

            const names = ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit'];

            await withServer(options, () => {
                for (const name of names) {
                    during[name] = proc.listenerCount(name);
                }
                return Promise.resolve();
            });

            expect(during).toEqual({ SIGINT: 1, SIGTERM: 1, SIGHUP: 1, exit: 1 });
            for (const name of names) {
                expect(proc.listenerCount(name), name).toBe(0);
            }
        });

        it('does not signal a second time for a signal that arrives after it stopped', async () => {
            const { options, kill, proc } = setup();

            await withServer(options, () => Promise.resolve());
            proc.emit('SIGINT');

            expect(kill).toHaveBeenCalledTimes(1);
        });
    });
});

describe('killServerGroup', () => {
    it('signals the wrapper itself where the group cannot be addressed', () => {
        const server = { pid: 4242, kill: vi.fn() };
        const kill = vi.fn(() => {
            throw new Error('ESRCH');
        });

        expect(() => killServerGroup(server, { kill })).not.toThrow();
        expect(server.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
    });

    it('does nothing for a server that never got a pid', () => {
        const server = { pid: undefined, kill: vi.fn() };
        const kill = vi.fn();

        killServerGroup(server, { kill });

        expect(kill).not.toHaveBeenCalled();
        expect(server.kill).not.toHaveBeenCalled();
    });
});

describe('startedServerAnswers', () => {
    /* If the port was taken in the instant between choosing it and binding it, the probe's own server
       dies of EADDRINUSE while the OTHER one keeps answering. An answer then counts for nothing. */
    it('passes the answer through while the server the probe started is alive', async () => {
        const alive = { exitCode: null, signalCode: null };

        await expect(startedServerAnswers(alive, () => Promise.resolve(true))).resolves.toBe(true);
        await expect(startedServerAnswers(alive, () => Promise.resolve(false))).resolves.toBe(
            false
        );
    });

    it('refuses to count an answer once the server it started has exited', async () => {
        const answers = vi.fn(() => Promise.resolve(true));

        await expect(
            startedServerAnswers({ exitCode: 1, signalCode: null }, answers)
        ).rejects.toThrow(/exited/);
        expect(answers).not.toHaveBeenCalled();
    });

    it('refuses the same way when the server was ended by a signal', async () => {
        const answers = vi.fn(() => Promise.resolve(true));

        await expect(
            startedServerAnswers({ exitCode: null, signalCode: 'SIGKILL' }, answers)
        ).rejects.toThrow(/SIGKILL/);
        expect(answers).not.toHaveBeenCalled();
    });
});
