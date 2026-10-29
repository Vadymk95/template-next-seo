import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    clearScreenshots,
    GROUP_FILE,
    hasRenderedContent,
    killServerGroup,
    launchProbeBrowser,
    measureInPage,
    OUT_DIR,
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

describe('clearScreenshots', () => {
    /* The folder also holds the record of the server a running, or a killed, probe started: the next
       run reads it to find a group nobody stopped. Wiping the whole folder deleted it unread. */
    const folders = [];
    const folder = () => {
        const dir = mkdtempSync(join(tmpdir(), 'probe-out-'));
        folders.push(dir);
        return dir;
    };
    afterEach(() => {
        for (const dir of folders.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('removes the screenshots of the last run', () => {
        const dir = folder();
        writeFileSync(join(dir, 'login-390.png'), 'png');
        writeFileSync(join(dir, 'root-1440.png'), 'png');

        clearScreenshots(dir);

        expect(existsSync(join(dir, 'login-390.png'))).toBe(false);
        expect(existsSync(join(dir, 'root-1440.png'))).toBe(false);
    });

    it('keeps the record of a server group, which is not a screenshot', () => {
        const dir = folder();
        writeFileSync(join(dir, 'server.json'), '{}');
        writeFileSync(join(dir, 'login-390.png'), 'png');

        clearScreenshots(dir);

        expect(existsSync(join(dir, 'server.json'))).toBe(true);
    });

    it('creates the folder when it is not there yet', () => {
        const dir = join(folder(), 'nested');

        clearScreenshots(dir);

        expect(existsSync(dir)).toBe(true);
    });

    it('keeps the record inside the folder the repository already ignores', () => {
        const ignored = readFileSync(join(import.meta.dirname, '..', '.gitignore'), 'utf8')
            .split('\n')
            .map((line) => line.trim());

        expect(dirname(GROUP_FILE)).toBe(OUT_DIR);
        expect(ignored).toContain(`${OUT_DIR}/`);
    });

    // `run` is the one caller and it needs a build and a browser, so the case reads the source: a
    // probe that wipes the folder itself reads no record, whatever `clearScreenshots` keeps.
    it('is what the probe runs to clear the folder, which nothing else removes', () => {
        const source = readFileSync(join(import.meta.dirname, 'probe.mjs'), 'utf8');

        expect(source).toContain('clearScreenshots();');
        expect(source).not.toMatch(/rmSync\(\s*OUT_DIR/);
    });
});

/* The server the probe starts is `npm run dev`, which starts `next dev`, which starts workers. Three
   things went wrong with a bare `spawn` and `server.kill()`: the probe took its port whether or not
   something already answered there and measured THAT server (another checkout's tree); a signal or a
   failed browser launch skipped the cleanup; and signalling the npm wrapper alone left the server
   listening. A fourth surfaced with the fix: a probe killed outright runs no cleanup at all, so its
   group is recorded in a file the next run reads. Nothing below starts a real server: the spawn, the
   port search, the process, the signal table and the file of the record are all injected. */
describe('withServer', () => {
    const PID = 4242;
    const STALE = 5151;
    const OTHER = 6363;
    const START = 'Thu Oct 29 14:13:04 2026';
    const RECORD = 'out/server.json';
    const serverArgs = (port, script = 'dev') => ['run', script, '--', '--port', String(port)];
    const failure = (code) => Object.assign(new Error(code), { code });
    const fakeServer = (overrides = {}) => ({
        pid: PID,
        exitCode: null,
        signalCode: null,
        kill: vi.fn(),
        ...overrides
    });

    /* `groups` and `processes` are what already runs; a spawned server joins `groups`. SIGKILL always
       ends a group, any other signal only when `endsOn` names it, so `endsOn: 'SIGKILL'` is a server
       that ignores SIGTERM. `files` is the disk the record lives on. `findPort` is a stub that returns
       the base port unless the case hands one in; `realSearch` leaves it out, so the case meets the
       search `withServer` uses by default. */
    const setup = ({
        server = fakeServer(),
        findPort,
        realSearch = false,
        useDev = true,
        basePort = 3000,
        groups = [],
        processes = [],
        files = {},
        endsOn = 'SIGTERM'
    } = {}) => {
        const liveGroups = new Set(groups);
        const liveProcesses = new Set(processes);
        const kill = vi.fn((target, signal) => {
            if (signal === 0) {
                const alive = target < 0 ? liveGroups.has(-target) : liveProcesses.has(target);
                if (!alive) {
                    throw failure('ESRCH');
                }
                return true;
            }
            if (!liveGroups.has(-target)) {
                throw failure('ESRCH');
            }
            if (signal === endsOn || signal === 'SIGKILL') {
                liveGroups.delete(-target);
            }
            return true;
        });
        const sent = () => kill.mock.calls.filter(([, signal]) => signal !== 0);
        const disk = new Map(Object.entries(files));
        const spawnServer = vi.fn(() => {
            if (server.pid !== undefined) {
                liveGroups.add(server.pid);
            }
            return server;
        });
        const proc = Object.assign(new EventEmitter(), { exit: vi.fn() });
        const log = vi.fn();
        const group = {
            kill,
            identify: () => ({ start: START, command: serverArgs(3000).join(' ') }),
            wait: () => Promise.resolve(),
            termMs: 300,
            pollMs: 100,
            read: (file) => {
                if (!disk.has(file)) {
                    throw failure('ENOENT');
                }
                return disk.get(file);
            },
            write: (file, text) => {
                disk.set(file, text);
            },
            remove: (file) => {
                disk.delete(file);
            }
        };
        const options = {
            useDev,
            basePort,
            environment: { KEEP: 'yes', PORT: 'stale' },
            spawnServer,
            proc,
            groupFile: RECORD,
            group,
            log
        };
        if (!realSearch) {
            options.findPort = findPort ?? vi.fn((base) => Promise.resolve(base));
        }
        return { server, spawnServer, kill, sent, proc, options, disk, log, liveGroups };
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
                serverArgs(3000),
                expect.objectContaining({ detached: true, shell: false, stdio: 'ignore' })
            );
            expect(spawnServer.mock.calls[0][2].env).toMatchObject({ KEEP: 'yes', PORT: '3000' });
        });

        it('runs the production server for a build', async () => {
            const { options, spawnServer } = setup({ useDev: false, basePort: 3100 });

            await withServer(options, () => Promise.resolve());

            expect(spawnServer.mock.calls[0][1]).toEqual(serverArgs(3100, 'start'));
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
            expect(spawnServer.mock.calls[0][1]).toEqual(serverArgs(3007));
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
            const { options, spawnServer, proc, disk } = setup({ findPort });

            await expect(withServer(options, () => Promise.resolve())).rejects.toThrow(
                /No free port/
            );

            expect(spawnServer).not.toHaveBeenCalled();
            expect(proc.listenerCount('SIGINT')).toBe(0);
            expect(disk.has(RECORD)).toBe(false);
        });
    });

    describe('stopping it', () => {
        it('signals the whole group, not the wrapper, when the body succeeds', async () => {
            const { options, sent, server } = setup();

            await withServer(options, () => Promise.resolve());

            expect(sent()).toEqual([[-PID, 'SIGTERM']]);
            expect(server.kill).not.toHaveBeenCalled();
        });

        it('signals the group when the body fails, and lets the failure through', async () => {
            const { options, sent } = setup();

            await expect(
                withServer(options, () => Promise.reject(new Error('browser did not launch')))
            ).rejects.toThrow('browser did not launch');

            expect(sent()).toEqual([[-PID, 'SIGTERM']]);
        });

        /* SIGHUP is a closed terminal: the detached server is not in the terminal's session, so it
           would be the one process left running. */
        it.each([
            ['SIGINT', 130],
            ['SIGTERM', 143],
            ['SIGHUP', 129]
        ])('signals the group on %s and exits with %i', async (signal, code) => {
            const { options, sent, proc } = setup();

            await withServer(options, () => {
                proc.emit(signal);
                return Promise.resolve();
            });

            expect(sent()).toEqual([[-PID, 'SIGTERM']]);
            expect(proc.exit).toHaveBeenCalledExactlyOnceWith(code);
        });

        it('ends the process only after the stop is over, SIGKILL and the record included', async () => {
            // The group ignores SIGTERM, so the stop has to wait and escalate before the exit.
            const { options, sent, proc, disk } = setup({ endsOn: 'SIGKILL' });
            let atExit;
            proc.exit.mockImplementation(() => {
                atExit = { sent: sent(), record: disk.has(RECORD) };
            });

            await withServer(options, () => {
                proc.emit('SIGINT');
                return Promise.resolve();
            });

            expect(atExit).toEqual({
                sent: [
                    [-PID, 'SIGTERM'],
                    [-PID, 'SIGKILL']
                ],
                record: false
            });
        });

        it('signals the group the moment the process is ending, and keeps the record while the group is still there', async () => {
            // `endsOn: 'SIGKILL'`: the group outlives SIGTERM for a moment, as a real one does.
            const { options, sent, proc, disk } = setup({ endsOn: 'SIGKILL' });

            await withServer(options, () => {
                proc.emit('exit');
                // An exit handler cannot wait: nothing after it runs, so the signal has to be out
                // already and the record has to be there for the run that follows to read.
                expect(sent()).toEqual([[-PID, 'SIGTERM']]);
                expect(disk.has(RECORD)).toBe(true);
                return Promise.resolve();
            });

            expect(sent().slice(0, 1)).toEqual([[-PID, 'SIGTERM']]);
        });

        /* After a Ctrl-C the browser library's own handler can end the process before the stop has
           finished its pause; the group is usually gone by then, and its record is no use. */
        it('removes the record at once when the process ends after the group has already left', async () => {
            const { options, proc, disk, liveGroups } = setup();

            await withServer(options, () => {
                liveGroups.delete(PID);
                proc.emit('exit');
                expect(disk.has(RECORD)).toBe(false);
                return Promise.resolve();
            });
        });

        it('signals once when a signal and the end of the body both ask', async () => {
            const { options, sent, proc } = setup();

            await withServer(options, () => {
                proc.emit('SIGINT');
                proc.emit('exit');
                return Promise.resolve();
            });

            expect(sent()).toEqual([[-PID, 'SIGTERM']]);
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
            const { options, sent, proc } = setup();

            await withServer(options, () => Promise.resolve());
            proc.emit('SIGINT');

            expect(sent()).toHaveLength(1);
        });

        it('kills a group that ignores SIGTERM once the grace period is spent', async () => {
            const { options, sent } = setup({ endsOn: 'SIGKILL' });

            await withServer(options, () => Promise.resolve());

            expect(sent()).toEqual([
                [-PID, 'SIGTERM'],
                [-PID, 'SIGKILL']
            ]);
        });
    });

    describe('the record of the group', () => {
        // What a second probe in the same checkout writes while this one runs: the file is shared and
        // the last to start owns it, so it names a group that is not this run's.
        const theirs = JSON.stringify({
            pid: OTHER,
            port: 3001,
            args: serverArgs(3001),
            owner: 1,
            start: START
        });

        it('is written right after the spawn, while the body runs', async () => {
            const { options, disk } = setup();
            let during;

            await withServer(options, () => {
                during = JSON.parse(disk.get(RECORD));
                return Promise.resolve();
            });

            expect(during).toEqual({
                pid: PID,
                port: 3000,
                args: serverArgs(3000),
                owner: process.pid,
                start: START
            });
        });

        it('is removed when the body succeeds', async () => {
            const { options, disk } = setup();

            await withServer(options, () => Promise.resolve());

            expect(disk.has(RECORD)).toBe(false);
        });

        it('is removed when the body fails', async () => {
            const { options, disk } = setup();

            await expect(
                withServer(options, () => Promise.reject(new Error('browser did not launch')))
            ).rejects.toThrow('browser did not launch');

            expect(disk.has(RECORD)).toBe(false);
        });

        it('is removed after a signal as well', async () => {
            const { options, disk, proc } = setup();

            await withServer(options, () => {
                proc.emit('SIGINT');
                return Promise.resolve();
            });

            expect(disk.has(RECORD)).toBe(false);
        });

        it('is removed once a group that ignored SIGTERM has been killed', async () => {
            const { options, disk } = setup({ endsOn: 'SIGKILL' });

            await withServer(options, () => Promise.resolve());

            expect(disk.has(RECORD)).toBe(false);
        });

        it('is removed when the group had already left before the stop', async () => {
            const { options, disk, liveGroups } = setup();

            await withServer(options, () => {
                liveGroups.delete(PID);
                return Promise.resolve();
            });

            expect(disk.has(RECORD)).toBe(false);
        });

        /* A group that could not be signalled was never asked to stop and may still hold the port. Its
           record is what lets the next run say so. */
        it('is kept when the group could not be signalled', async () => {
            const { options, disk, server } = setup();
            const refused = vi.fn((_target, signal) => {
                if (signal === 0) {
                    return true;
                }
                throw failure('EPERM');
            });

            await withServer({ ...options, group: { ...options.group, kill: refused } }, () =>
                Promise.resolve()
            );

            expect(server.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
            expect(disk.has(RECORD)).toBe(true);
        });

        it("is left alone when another run has written its own since: it is not this run's to remove", async () => {
            const { options, disk, sent } = setup();

            await withServer(options, () => {
                disk.set(RECORD, theirs);
                return Promise.resolve();
            });

            expect(sent()).toEqual([[-PID, 'SIGTERM']]);
            expect(disk.get(RECORD)).toBe(theirs);
        });

        it("is left alone by the end of the process as well, when it is another run's", async () => {
            const { options, proc, disk, liveGroups } = setup();

            await withServer(options, () => {
                liveGroups.delete(PID);
                disk.set(RECORD, theirs);
                proc.emit('exit');
                expect(disk.get(RECORD)).toBe(theirs);
                return Promise.resolve();
            });
        });

        it('is not written for a server that never got a pid', async () => {
            const { options, disk, sent } = setup({ server: fakeServer({ pid: undefined }) });
            let during;

            await withServer(options, () => {
                during = disk.has(RECORD);
                return Promise.resolve();
            });

            expect(during).toBe(false);
            expect(sent()).toEqual([]);
        });
    });

    describe('a group an earlier run left behind', () => {
        const stale = (overrides = {}) =>
            JSON.stringify({
                pid: STALE,
                port: 3000,
                args: serverArgs(3000),
                owner: 1,
                start: START,
                ...overrides
            });

        it('is stopped before a port is chosen, so its port is free when the search looks', async () => {
            const findPort = vi.fn();
            const harness = setup({ groups: [STALE], files: { [RECORD]: stale() }, findPort });
            let sentWhenSearching;
            findPort.mockImplementation((base) => {
                sentWhenSearching = harness.sent();
                return Promise.resolve(base);
            });

            await withServer(harness.options, () => Promise.resolve());

            expect(sentWhenSearching).toEqual([[-STALE, 'SIGTERM']]);
            expect(harness.log).toHaveBeenCalledWith(expect.stringMatching(/stopped.*5151/));
        });

        it('is left alone while the run that started it is still alive', async () => {
            const harness = setup({
                groups: [STALE],
                processes: [1],
                files: { [RECORD]: stale() }
            });

            await withServer(harness.options, () => Promise.resolve());

            expect(harness.sent()).toEqual([[-PID, 'SIGTERM']]);
            expect(harness.log).toHaveBeenCalledWith(expect.stringMatching(/still running/));
        });
    });
});

describe('killServerGroup', () => {
    const failure = (code) => Object.assign(new Error(code), { code });

    it.each(['ESRCH', 'EPERM'])(
        'signals the wrapper itself where the group cannot be addressed (%s)',
        async (code) => {
            const server = { pid: 4242, kill: vi.fn() };
            const kill = vi.fn(() => {
                throw failure(code);
            });

            await killServerGroup(server, { kill });

            expect(server.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
        }
    );

    it('leaves the wrapper to the group signal where the group could be addressed', async () => {
        const server = { pid: 4242, kill: vi.fn() };
        const kill = vi.fn();

        await expect(
            killServerGroup(server, { kill, isAlive: () => false, wait: () => Promise.resolve() })
        ).resolves.toBe('terminated');

        expect(server.kill).not.toHaveBeenCalled();
    });

    it('does nothing for a server that never got a pid', async () => {
        const server = { pid: undefined, kill: vi.fn() };
        const kill = vi.fn();

        await killServerGroup(server, { kill });

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
