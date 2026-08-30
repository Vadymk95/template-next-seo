#!/usr/bin/env node
/**
 * The MEASURE moment: answering a question only a rendered result can answer.
 *
 * Building in order to look at the outcome is legitimate work at ANY moment — without a named
 * rung for it, every honest measurement gets logged as a tier violation and the trace cannot say
 * what a task actually cost (measured in a sibling repo: twelve "violations" in two days, all of
 * them measurements). This script is that rung: production build, then either the named
 * Playwright spec(s) against `next start` on a FREE port, or the exact command to look by hand.
 *
 * It deliberately does NOT run lint/types/tests — measuring is not verifying, and bundling them
 * back in would recreate the cost this rung exists to remove.
 *
 * Usage: npm run verify:measure                 # build + how to look
 *        npm run verify:measure -- e2e/x.spec.ts  # build + that spec, prod mode, free port
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

/** Pure plan builder so the step composition is testable without paying for a build. */
export const buildMeasurePlan = (specArgs) => {
    const steps = [
        {
            label: 'build env',
            command: process.execPath,
            args: [join(SCRIPTS_DIR, 'check-build-env.mjs')]
        },
        { label: 'build', command: 'npm', args: ['run', 'build'] }
    ];
    if (specArgs.length > 0) {
        steps.push({
            label: 'measure e2e',
            command: process.execPath,
            args: [
                join(SCRIPTS_DIR, 'run-on-free-port.mjs'),
                'npx',
                '--no-install',
                'playwright',
                'test',
                ...specArgs
            ],
            env: { PLAYWRIGHT_PROD_SERVER: '1' }
        });
    }
    return steps;
};

const main = () => {
    const specArgs = process.argv.slice(2);
    const steps = buildMeasurePlan(specArgs);

    for (const step of steps) {
        const result = spawnSync(step.command, step.args, {
            stdio: 'inherit',
            shell: false,
            env: { ...process.env, ...(step.env ?? {}) }
        });
        if (result.status !== 0) {
            console.error(`✖ measure stopped at "${step.label}".`);
            process.exit(result.status ?? 1);
        }
    }

    if (specArgs.length === 0) {
        console.log('Built. To look at it: node scripts/run-on-free-port.mjs npm start');
        console.log('To measure one spec: npm run verify:measure -- e2e/<name>.spec.ts');
    }
};

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
