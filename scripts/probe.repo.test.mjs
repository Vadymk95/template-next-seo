// The cases of probe.test.mjs that read this repository's own files: the folder `.gitignore` already
// covers, and the server the probe starts, which is the `probe` key of scripts/gate-tiers.json. The
// rest of that file lives in gatelaw.
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { GROUP_FILE, OUT_DIR, readProbeConfig, withServer } from './probe.mjs';

describe('clearScreenshots', () => {
    it('keeps the record inside the folder the repository already ignores', () => {
        const ignored = readFileSync(join(import.meta.dirname, '..', '.gitignore'), 'utf8')
            .split('\n')
            .map((line) => line.trim());

        expect(dirname(GROUP_FILE)).toBe(OUT_DIR);
        expect(ignored).toContain(`${OUT_DIR}/`);
    });
});

/* The probe starts `npm run dev` or `npm run start`, with the port in the arguments; which of the two,
   with which arguments and from which port, is data in this repository, so the cases read the real
   file. Nothing below starts a server: the spawn, the port search and the record are stubs. */
describe('withServer', () => {
    const PID = 4242;
    const serverArgs = (port, script) => ['run', script, '--', '--port', String(port)];
    const { config, error } = readProbeConfig();

    const run = async ({ useDev, serve }) => {
        const liveGroups = new Set();
        const spawnServer = vi.fn(() => {
            liveGroups.add(PID);
            return { pid: PID, exitCode: null, signalCode: null, kill: vi.fn() };
        });
        const kill = vi.fn((target, signal) => {
            if (!liveGroups.has(-target)) {
                throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
            }
            if (signal !== 0) liveGroups.delete(-target);
            return true;
        });
        const disk = new Map();
        await withServer(
            {
                useDev,
                basePort: serve.port,
                serve,
                environment: {},
                findPort: (base) => Promise.resolve(base),
                spawnServer,
                proc: Object.assign(new EventEmitter(), { exit: vi.fn() }),
                groupFile: 'out/server.json',
                group: {
                    kill,
                    identify: () => ({ start: 'now', command: 'npm' }),
                    wait: () => Promise.resolve(),
                    termMs: 0,
                    pollMs: 0,
                    read: (file) => {
                        if (!disk.has(file))
                            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
                        return disk.get(file);
                    },
                    write: (file, text) => disk.set(file, text),
                    remove: (file) => disk.delete(file)
                },
                log: vi.fn()
            },
            () => Promise.resolve()
        );
        return spawnServer.mock.calls[0];
    };

    it('reads the probe key of this repository without complaint', () => {
        expect(error).toBeUndefined();
        expect(config.userSeed).toBeNull();
    });

    describe('the server it starts', () => {
        it('runs the dev server on the port this repository names', async () => {
            const call = await run({ useDev: true, serve: config.dev });

            expect(config.dev.port).toBe(3000);
            expect(call[0]).toBe('npm');
            expect(call[1]).toEqual(serverArgs(3000, 'dev'));
        });

        it('runs the production server for a build', async () => {
            const call = await run({ useDev: false, serve: config.prod });

            expect(config.prod.port).toBe(3100);
            expect(call[0]).toBe('npm');
            expect(call[1]).toEqual(serverArgs(3100, 'start'));
        });
    });
});
