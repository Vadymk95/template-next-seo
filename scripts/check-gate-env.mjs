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
    problems.push(
        `Port ${String(port)} is busy, and the production e2e wants it.\n` +
            `      A dev server already listening there is the common case; do not kill it.\n` +
            `      Run:  PORT=3100 PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run verify:ci`
    );
}

if (problems.length > 0) {
    console.error('\nGate preflight failed:\n');
    for (const problem of problems) {
        console.error(`  - ${problem}\n`);
    }
    process.exit(1);
}
