import { describe, expect, it } from 'vitest';

import { buildMeasurePlan } from './verify-measure.mjs';

describe('buildMeasurePlan', () => {
    it('with no specs: env check then build, and nothing else — measuring is not verifying', () => {
        const steps = buildMeasurePlan([]);
        expect(steps.map((s) => s.label)).toEqual(['build env', 'build']);
        const commands = steps.map((s) => `${s.command} ${s.args.join(' ')}`).join('\n');
        expect(commands).not.toMatch(/lint|coverage|vitest|typecheck/);
    });

    it('with specs: appends ONE prod-mode Playwright run on a free port, carrying the spec names', () => {
        const steps = buildMeasurePlan(['e2e/nav-ux.spec.ts']);
        const last = steps[steps.length - 1];
        expect(last?.label).toBe('measure e2e');
        expect(last?.env).toEqual({ PLAYWRIGHT_PROD_SERVER: '1' });
        expect(last?.args.join(' ')).toContain('run-on-free-port.mjs');
        expect(last?.args.join(' ')).toContain(
            'npx --no-install playwright test e2e/nav-ux.spec.ts'
        );
    });

    it('passes every given spec through, not just the first', () => {
        const steps = buildMeasurePlan(['a.spec.ts', 'b.spec.ts']);
        const last = steps[steps.length - 1];
        expect(last?.args).toContain('a.spec.ts');
        expect(last?.args).toContain('b.spec.ts');
    });
});
