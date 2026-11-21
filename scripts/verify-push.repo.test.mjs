// The case of verify-push.test.mjs that reads this repository's own gate-tiers.json and package.json:
// the stages the phase-0 push leaves out are the ones the full gate has and `verify:scaffold` lacks.
// The other cases live in gatelaw, over fixture packages.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { resolvePushPlan, skippedStages } from './verify-push.mjs';

describe('skippedStages (derived from the two chains)', () => {
    const skipped = (checks, scripts) =>
        skippedStages({ checks, scripts, full: 'verify:ci', scaffold: 'verify:scaffold:push' });

    it('in this repository, names every stage the full gate has and verify:scaffold lacks', () => {
        const { checks } = JSON.parse(readFileSync('scripts/gate-tiers.json', 'utf8'));
        const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
        const stages = (name) => checks[name].chain.split(' -> ');
        // `verify` is an alias of `verify:enterprise`, which holds the chain.
        expect(scripts.verify).toBe('npm run verify:enterprise');
        const expected = stages('verify:enterprise').filter(
            (stage) => !stages('verify:scaffold').includes(stage)
        );

        expect(expected.length).toBeGreaterThan(0);
        expect(skipped(checks, scripts)).toEqual(expected);
        expect(resolvePushPlan({ phase: 0, override: undefined, checks, scripts }).skipped).toEqual(
            expected
        );
    });
});
