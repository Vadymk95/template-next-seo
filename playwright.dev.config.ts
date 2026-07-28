import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_DEV_BASE_URL ?? 'http://localhost:3003';
const isCI = Boolean(process.env.CI);

/**
 * Turbopack dev smoke, deliberately separate from the production gate.
 *
 * Why it exists: `dev` runs Turbopack and `build` runs webpack with a custom
 * `splitChunks` hook, so the gate only ever exercises the webpack output. A
 * Turbopack-only crash on a route would ship unnoticed.
 *
 * Why it is not in `verify`: a cold Turbopack boot costs 10-30s per run, a poor
 * trade on every local push for a path that breaks mainly when routing or
 * configuration changes. It runs as its own CI job instead, so it is mandatory on
 * every PR and cannot be forgotten, and `npm run verify:full` chains it locally.
 *
 * `playwright.config.ts` must keep `e2e/dev/**` in its `testIgnore`, or the
 * production project collects these specs and runs them against `next start` —
 * which can PASS, because a production build is quieter, making the Turbopack
 * coverage an illusion.
 */
export default defineConfig({
    testDir: 'e2e/dev',
    fullyParallel: false,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },
    projects: [{ name: 'dev-chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev -- --port 3003',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe'
    }
});
