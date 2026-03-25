/**
 * Runs the same gate sequence as CI with per-step timings (local benchmarking).
 * Usage: node scripts/bench-verify.mjs
 */

import { spawnSync } from 'node:child_process';

const steps = [
    ['lint', 'npm', ['run', 'lint']],
    ['format', 'npm', ['run', 'format:check']],
    ['tsc', 'npx', ['tsc', '--noEmit']],
    ['test', 'npm', ['test']],
    ['build', 'npm', ['run', 'build']]
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
