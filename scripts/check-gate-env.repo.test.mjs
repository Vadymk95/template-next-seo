// The cases of check-gate-env.test.mjs that run the preflight over this repository's own files: the
// `gateEnv` key of scripts/gate-tiers.json (the production server's port, the variable that moves it,
// the hint it prints) and the real scripts/check-build-env.mjs the preflight runs first. The rest of
// that file lives in gatelaw, over stand-in build checks and configurations written in the test.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { quietPort } from './quiet-ports.mjs';

// Resolved from the repo root, not from `import.meta.url`: vitest serves this module over its own
// transform URL, so the file-URL form throws ERR_INVALID_URL_SCHEME rather than finding the script.
const SCRIPT = resolve(process.cwd(), 'scripts/check-gate-env.mjs');
const APP_URL = 'https://template-next-seo.invalid';

/* One port per role, from this checkout's quiet window (scripts/quiet-ports.mjs). Fixed numbers such
   as 3178 were shared by every checkout that ran this file at the same time, and a `listen(0)` port
   belongs to the OS's ephemeral range, where parallel tests meet each other's sockets. */
const PORT_FREE = quietPort('check-gate-env', 0);
const PORT_BUSY = quietPort('check-gate-env', 1);

/* `stdio` pipes stderr: without it execFileSync echoes the child's stderr into the parent, so a green
   run printed "Gate preflight failed" blocks from the cases that expect a refusal.
   `process.execPath`, not `node`: a case may hand the child a PATH that holds no binaries at all. */
const runPreflight = (env, cwd = process.cwd()) => {
    try {
        const output = execFileSync(process.execPath, [SCRIPT], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
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
        const verdict = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: String(PORT_FREE) });
        expect(verdict.code).toBe(0);
    });

    it('refuses a missing build URL, and prints the command that fixes it', () => {
        /* cwd is a directory with no `.env.local`, so @next/env finds nothing — the same state a
           fresh clone is in. The failure it replaces arrived minutes later as a ZodError naming a
           page rather than the variable. */
        const verdict = runPreflight({ PORT: String(PORT_FREE) }, tmpdir());
        expect(verdict.code).toBe(1);
        expect(verdict.output).toContain('NEXT_PUBLIC_APP_URL');
        expect(verdict.output).toContain('cp .env.example .env.local');
    });

    it('sees a port that is actually taken, on any interface', async () => {
        held = await listenOn(PORT_BUSY);
        /* Probing `127.0.0.1` alone reports a port FREE while a dev server is plainly holding
           it. This asserts the difference: same script, same env, one port held and one not. */
        const busy = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: String(PORT_BUSY) });
        const free = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: String(PORT_FREE) });

        expect(busy.code).toBe(1);
        expect(busy.output).toContain(`Port ${String(PORT_BUSY)} is busy`);
        expect(free.code).toBe(0);
    });

    /* The hint names ONE variable: `playwright.config.ts` follows `PORT` for its base URL, so a second
       one to keep in agreement is a way to point the tests at a different server than the one started. */
    it('hints a moved run with PORT alone', async () => {
        held = await listenOn(PORT_BUSY);
        const busy = runPreflight({ NEXT_PUBLIC_APP_URL: APP_URL, PORT: String(PORT_BUSY) });

        expect(busy.output).toContain('PORT=3100 npm run verify:ci');
        expect(busy.output).not.toContain('PLAYWRIGHT_BASE_URL');
    });

    it('reports BOTH problems at once rather than one per run', async () => {
        held = await listenOn(PORT_BUSY);
        const verdict = runPreflight({ PORT: String(PORT_BUSY) }, tmpdir());
        expect(verdict.code).toBe(1);
        expect(verdict.output).toContain('NEXT_PUBLIC_APP_URL');
        expect(verdict.output).toContain(`Port ${String(PORT_BUSY)} is busy`);
    });
});
