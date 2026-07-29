/**
 * Runs the same gate sequence as CI with per-step timings (local benchmarking).
 * Usage: node scripts/bench-verify.mjs
 */

import { spawnSync } from 'node:child_process';

// Mirrors `verify:enterprise`. If you change one, change the other — a bench that
// benchmarks a different set of steps than the gate is worse than no bench.
const steps = [
    ['hooks', 'node', ['scripts/check-hooks.mjs']],
    ['lint', 'npm', ['run', 'lint']],
    ['format', 'npm', ['run', 'format:check']],
    ['typecheck', 'npm', ['run', 'typecheck']],
    ['coverage', 'npm', ['run', 'test:coverage']],
    ['build-env', 'node', ['scripts/check-build-env.mjs']],
    ['build', 'npm', ['run', 'build']],
    ['playwright', 'node', ['scripts/ensure-playwright.mjs']],
    ['e2e', 'npm', ['run', 'test:e2e:prod']]
];

console.log('Enterprise verify benchmark (per step)\n');

for (const [label, cmd, args] of steps) {
    const start = performance.now();
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, ANALYZE: 'false' }
    });
    const ms = Math.round(performance.now() - start);
    console.log(`\n→ ${label}: ${ms} ms`);

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

console.log('\n✓ All steps passed\n');
