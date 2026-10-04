// @vitest-environment node
//
// Guards three properties of the Playwright configs: a red run must stop after a capped
// number of failures instead of running every remaining test into its timeouts (the gate run and
// CI only — the desk run against `next dev` stays uncapped), the gate config and the dev
// config must write `.last-run.json` to two different folders, or the second suite in the push
// chain overwrites the first's last-failed record and `--last-failed` selects the wrong tests,
// and in CI a test that passes only on a retry fails the run instead of reporting green.
//
// Both configs read `process.env` at import time, so each case needs a fresh module instance:
// `vi.resetModules()` plus a re-import, not a single cached import reused across cases with the
// env mutated around it. `@vitest-environment node` avoids the default jsdom environment: under
// jsdom, importing `@playwright/test` triggers a synchronous XHR that the repo's MSW setup
// (`shared/lib/test-utils/setup.ts`, loaded by every test via `setupFiles`) intercepts and never
// resolves, which stalls this file for the full XHR timeout.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = ['CI', 'PLAYWRIGHT_PROD_SERVER'];
const originalEnv = {};

beforeEach(() => {
    for (const key of ENV_KEYS) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
    }
});

afterEach(() => {
    for (const key of ENV_KEYS) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
    }
});

const importGateConfig = async () => {
    vi.resetModules();
    const mod = await import('../playwright.config.ts');
    return mod.default;
};

const importDevConfig = async () => {
    vi.resetModules();
    const mod = await import('../playwright.dev.config.ts');
    return mod.default;
};

describe('playwright.config.ts maxFailures', () => {
    it('caps at 10 when CI is set', async () => {
        process.env.CI = 'true';
        const config = await importGateConfig();
        expect(config.maxFailures).toBe(10);
    });

    it('caps at 10 when PLAYWRIGHT_PROD_SERVER is set', async () => {
        process.env.PLAYWRIGHT_PROD_SERVER = '1';
        const config = await importGateConfig();
        expect(config.maxFailures).toBe(10);
    });

    it('stays uncapped on the desk run against next dev (neither flag set)', async () => {
        const config = await importGateConfig();
        expect(config.maxFailures).toBeUndefined();
    });
});

describe('playwright configs outputDir', () => {
    it('gives the gate config and the dev config distinct, defined outputDir values', async () => {
        const gateConfig = await importGateConfig();
        const devConfig = await importDevConfig();
        expect(gateConfig.outputDir).toBeTruthy();
        expect(devConfig.outputDir).toBeTruthy();
        expect(gateConfig.outputDir).not.toBe(devConfig.outputDir);
    });
});

describe.each([
    ['playwright.config.ts', importGateConfig],
    ['playwright.dev.config.ts', importDevConfig]
])('%s failOnFlakyTests', (_name, importConfig) => {
    it('fails the run on a test that passed only on a retry when CI is set', async () => {
        process.env.CI = 'true';
        const config = await importConfig();
        expect(config.retries).toBeGreaterThan(0);
        expect(config.failOnFlakyTests).toBe(true);
    });

    it('does not fail on a flaky test off CI, where there are no retries', async () => {
        const config = await importConfig();
        expect(config.failOnFlakyTests).toBe(false);
    });
});
