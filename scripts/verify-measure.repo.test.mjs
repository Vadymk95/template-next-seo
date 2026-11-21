// The cases of verify-measure.test.mjs that run the measure plan over this repository's own
// `measure` key in scripts/gate-tiers.json: the environment check before the build and the
// production server the Playwright run starts. The rest of that file lives in gatelaw, over
// configurations written in the test.
import { describe, expect, it } from 'vitest';

import { buildMeasurePlan, readMeasureConfig } from './verify-measure.mjs';

describe('buildMeasurePlan', () => {
    const { config, error } = readMeasureConfig();

    it('reads the measure key of this repository without complaint', () => {
        expect(error).toBeUndefined();
        expect(config.serveCommand).toBe('npm start');
    });

    it('with no specs: env check then build, and nothing else — measuring is not verifying', () => {
        const steps = buildMeasurePlan([], config);
        expect(steps.map((s) => s.label)).toEqual(['build env', 'build']);
        const commands = steps.map((s) => `${s.command} ${s.args.join(' ')}`).join('\n');
        expect(commands).not.toMatch(/lint|coverage|vitest|typecheck/);
    });

    it('with specs: appends ONE prod-mode Playwright run on a free port, carrying the spec names', () => {
        const steps = buildMeasurePlan(['e2e/nav-ux.spec.ts'], config);
        const last = steps[steps.length - 1];
        expect(last?.label).toBe('measure e2e');
        expect(last?.env).toEqual({ PLAYWRIGHT_PROD_SERVER: '1' });
        expect(last?.args.join(' ')).toContain('run-on-free-port.mjs');
        expect(last?.args.join(' ')).toContain(
            'npx --no-install playwright test e2e/nav-ux.spec.ts'
        );
    });
});
