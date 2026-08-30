import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// Resolved from the repo root, not from `import.meta.url`: vitest serves this module over its own
// transform URL, so the file-URL form throws ERR_INVALID_URL_SCHEME rather than finding the script.
const SCRIPT = resolve(process.cwd(), 'scripts/check-gate-env.mjs');
const APP_URL = 'https://template-next-seo.invalid';

const runPreflight = (env, cwd = process.cwd(), extraArgs = []) => {
    try {
        const output = execFileSync('node', [SCRIPT, ...extraArgs], {
            encoding: 'utf8',
            cwd,
            /* A clean environment, so the developer's own shell cannot make this pass or fail. */
            env: {
                PATH: process.env.PATH ?? '',
                NODE_ENV: process.env.NODE_ENV ?? 'test',
                ...env
            }
        });
        return { code: 0, output };
    } catch (error) {
        return {
            code: error.status ?? 1,
            output: `${error.stdout ?? ''}${error.stderr ?? ''}`
        };
    }
};

const listenOn = async (port) =>
    new Promise((resolvePromise, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(port, () => {
            resolvePromise(server);
        });
    });

let held = null;

afterEach(async () => {
    await new Promise((resolvePromise) => held?.close(resolvePromise) ?? resolvePromise(null));
    held = null;
});

describe('gate preflight', () => {
    it('passes when the build env is set and the port is free', () => {
        const verdict = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: '3178' });
        expect(verdict.code).toBe(0);
    });

    it('refuses a missing build URL, and prints the command that fixes it', () => {
        /* cwd is a directory with no `.env.local`, so @next/env finds nothing — the same state a
           fresh clone is in. The failure it replaces arrived minutes later as a ZodError naming a
           page rather than the variable. */
        const verdict = runPreflight({ PORT: '3178' }, tmpdir());
        expect(verdict.code).toBe(1);
        expect(verdict.output).toContain('NEXT_PUBLIC_APP_URL');
        expect(verdict.output).toContain('cp .env.example .env.local');
    });

    it('sees a port that is actually taken, on any interface', async () => {
        held = await listenOn(3179);
        /* Probing `127.0.0.1` alone reports a port FREE while a dev server is plainly holding
           it. This asserts the difference: same script, same env, one port held and one not. */
        const busy = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: '3179' });
        const free = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: '3178' });

        expect(busy.code).toBe(1);
        expect(busy.output).toContain('Port 3179 is busy');
        expect(busy.output).toContain('PORT=3100');
        expect(free.code).toBe(0);
    });

    it('without --kill-port a busy port only REFUSES — manual runs never kill anything', async () => {
        held = await listenOn(3179);
        const verdict = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: '3179' });
        expect(verdict.code).toBe(1);
        /* The holder here is THIS vitest process; surviving the run is the assertion. */
        expect(verdict.output).toContain('--kill-port');
    });

    it('--kill-port clears a stray listener and proceeds, naming the pid it killed', async () => {
        /* The holder is a SEPARATE child process, never the suite's own server: the gate kills
           the port's owner, and killing the suite would prove the wrong thing the hard way. */
        const { spawn } = await import('node:child_process');
        const holder = spawn(
            'node',
            [
                '-e',
                'require("net").createServer().listen(3181, () => {}); setInterval(() => {}, 1000)'
            ],
            { stdio: 'ignore' }
        );
        await new Promise((resolvePromise) => {
            const probe = () => {
                const socket = createServer();
                socket.once('error', () => {
                    resolvePromise(null);
                });
                socket.once('listening', () => {
                    socket.close(() => setTimeout(probe, 50));
                });
                socket.listen(3181);
            };
            probe();
        });

        const verdict = runPreflight(
            { NEXT_PUBLIC_APP_URL: APP_URL, PORT: '3181' },
            process.cwd(),
            ['--kill-port']
        );
        try {
            expect(verdict.code).toBe(0);
            expect(verdict.output).toContain('Cleared port 3181');
            expect(verdict.output).toContain(String(holder.pid));
        } finally {
            try {
                holder.kill('SIGKILL');
            } catch {
                /* already dead — that is the expected case */
            }
        }
    });

    it('--kill-port on a FREE port stays silent and passes', () => {
        const verdict = runPreflight(
            { NEXT_PUBLIC_APP_URL: APP_URL, PORT: '3182' },
            process.cwd(),
            ['--kill-port']
        );
        expect(verdict.code).toBe(0);
        expect(verdict.output).not.toContain('Cleared');
    });

    it('reports BOTH problems at once rather than one per run', async () => {
        held = await listenOn(3179);
        const verdict = runPreflight({ PORT: '3179' }, tmpdir());
        expect(verdict.code).toBe(1);
        expect(verdict.output).toContain('NEXT_PUBLIC_APP_URL');
        expect(verdict.output).toContain('Port 3179 is busy');
    });
});
