#!/usr/bin/env node
/**
 * Preflight for the full gate: fail on the two things that make it fail LATER and unreadably.
 *
 * A missing build variable does not report itself — the build dies minutes in with a Zod trace
 * under "Failed to collect configuration for /_not-found", which reads as a broken route. And an
 * occupied port makes the production e2e either hang or, worse, silently measure a dev server that
 * happens to be listening — the wrong thing measured rather than a failure.
 *
 * The remedy is printed as a command, not as advice: a preflight that says "something is missing"
 * has moved the puzzle, not solved it.
 *
 * The env leg delegates to check-build-env.mjs — the one place that loads `.env*` the way
 * `next build` does (@next/env). A second reader here would be a second opinion waiting to drift.
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * --kill-port: the PUSH GATE owns the machine while it runs — heavy stages are serialised at the
 * push by rule, so anything still listening on the gate's port is a stray from an earlier lane
 * (a dev server someone forgot). The gate clears it and says what it killed. Parallel agent
 * lanes do the OPPOSITE: they move to a free port (scripts/run-on-free-port.mjs) and never kill
 * a server they did not start. Without the flag this preflight only refuses, for manual runs.
 */
const shouldKillPort = process.argv.includes('--kill-port');

const sleep = (ms) =>
    new Promise((resolvePromise) => {
        setTimeout(resolvePromise, ms);
    });

const listeningPids = (port) => {
    const result = spawnSync('lsof', ['-ti', `tcp:${String(port)}`, '-sTCP:LISTEN'], {
        encoding: 'utf8'
    });
    if (result.status !== 0 || !result.stdout) {
        return [];
    }
    return result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^\d+$/.test(line))
        .map(Number)
        .filter((pid) => pid !== process.pid);
};

const portIsFree = async (port) =>
    new Promise((resolve) => {
        const server = createServer();
        server.once('error', () => {
            resolve(false);
        });
        server.once('listening', () => {
            server.close(() => {
                resolve(true);
            });
        });
        // ALL interfaces, the way `next start` binds. Probing 127.0.0.1 alone reports the
        // port free while a dev server is plainly holding it — a guard that cannot see the
        // thing it guards.
        server.listen(port);
    });

const problems = [];

const buildEnv = spawnSync(process.execPath, [join(SCRIPTS_DIR, 'check-build-env.mjs')], {
    encoding: 'utf8'
});
if (buildEnv.status !== 0) {
    problems.push(`${buildEnv.stdout ?? ''}${buildEnv.stderr ?? ''}`.trim());
}

const port = Number(process.env.PORT ?? 3000);
if (!(await portIsFree(port))) {
    let cleared = false;
    if (shouldKillPort) {
        const pids = listeningPids(port);
        for (const pid of pids) {
            try {
                process.kill(pid, 'SIGTERM');
            } catch {
                // Already gone, or not ours to signal — the re-probe below is the verdict.
            }
        }
        if (pids.length > 0) {
            await sleep(1500);
            if (await portIsFree(port)) {
                cleared = true;
                console.log(
                    `Cleared port ${String(port)}: killed stray listener pid ${pids.join(', ')} (the push gate owns its port; parallel lanes use run-on-free-port instead).`
                );
            }
        }
    }
    if (!cleared) {
        problems.push(
            `Port ${String(port)} is busy, and the production e2e wants it.\n` +
                `      Another lane's server? Move this run: PORT=3100 PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run verify:ci\n` +
                (shouldKillPort
                    ? `      --kill-port could not clear it — look: lsof -nP -iTCP:${String(port)} -sTCP:LISTEN`
                    : `      The push gate clears its own port (--kill-port); by hand: lsof -ti tcp:${String(port)} -sTCP:LISTEN | xargs kill`)
        );
    }
}

if (problems.length > 0) {
    console.error('\nGate preflight failed:\n');
    for (const problem of problems) {
        console.error(`  - ${problem}\n`);
    }
    process.exit(1);
}
