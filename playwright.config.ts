import { defineConfig, devices } from '@playwright/test';

import { isCrossBrowserEnabled, LAYOUT_SPEC_PATTERN } from './e2e/support/cross-browser';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const isCI = Boolean(process.env.CI);
// Server mode and runner sizing are two unrelated concerns and carry separate
// flags. PLAYWRIGHT_PROD_SERVER picks `next start` over `next dev` (the gate's
// `test:e2e:prod` sets it); the real CI keeps retries/video and pins one worker
// for a two-core runner. When one `CI` flag carried both meanings, a local gate
// that wanted the production server also inherited the single worker.
const isProdServer = Boolean(process.env.PLAYWRIGHT_PROD_SERVER);

/**
 * Local: starts `next dev` (Turbopack) unless a server already listens (reuseExistingServer).
 * Gate/CI: after `npm run build`, PLAYWRIGHT_PROD_SERVER=1 starts `next start` for production-like E2E.
 */
export default defineConfig({
    testDir: 'e2e',
    // `e2e/dev/**` belongs to playwright.dev.config.ts: it needs a Turbopack dev
    // server, which this project does not start. Without this the specs are
    // collected here too and run against the production server — and they can
    // PASS in that wrong mode, which makes the Turbopack coverage an illusion.
    testIgnore: ['dev/**', '**/*.test.ts'],
    fullyParallel: true,
    // A forgotten `.only` must fail the local gate too, not only CI.
    forbidOnly: isCI || isProdServer,
    retries: isCI ? 2 : 0,
    ...(isCI ? { workers: 1 } : {}),
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: isCI ? 'retain-on-failure' : 'off'
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        ...(isCrossBrowserEnabled(process.env)
            ? [
                  {
                      name: 'firefox',
                      use: { ...devices['Desktop Firefox'] },
                      testMatch: LAYOUT_SPEC_PATTERN
                  },
                  /*
                   * WebKit is deliberately NOT in the PRODUCTION project list, and the reason is a
                   * measured platform interaction rather than a rendering difference.
                   *
                   * `next.config.ts` sends `Strict-Transport-Security` in production. This project runs
                   * `next start` over http://localhost, and WebKit APPLIES HSTS to localhost while
                   * Chromium exempts it — so every subresource is upgraded to `https://localhost`, every
                   * one fails with "A TLS error caused the secure connection to fail", and the page is
                   * measured with no stylesheet at all: `document.styleSheets` empty, the submit button
                   * 18px tall, the inputs 19px. Those numbers look like catastrophic layout defects and
                   * are an unstyled snapshot of a correctly-built page.
                   *
                   * Nothing here is wrong in production, where the origin IS https. What is unavailable
                   * is measuring a local production server in WebKit. WebKit still runs against the DEV
                   * server (`playwright.dev.config.ts`), which sends no HSTS, so the primitives keep
                   * their cross-engine coverage.
                   *
                   * Revisit when the production e2e can be served over TLS, or when the header is moved
                   * to the platform edge rather than the app.
                   */
                  {
                      name: 'webkit',
                      use: { ...devices['Desktop Safari'] },
                      testMatch: /$^/
                  }
              ]
            : [])
    ],
    webServer: {
        command: isProdServer ? 'npm run start' : 'npm run dev',
        url: baseURL,
        reuseExistingServer: !isProdServer,
        timeout: isCI ? 90_000 : 120_000,
        stdout: 'pipe',
        stderr: 'pipe'
    }
});
