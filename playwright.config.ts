import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const isCI = Boolean(process.env.CI);

/**
 * Local: starts `next dev` (Turbopack) unless a server already listens (reuseExistingServer).
 * CI: after `npm run build`, starts `next start` for production-like E2E (GitHub Actions sets CI=true).
 */
export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 1 : undefined,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: isCI ? 'retain-on-failure' : 'off'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: isCI ? 'npm run start' : 'npm run dev',
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: isCI ? 90_000 : 120_000,
        stdout: 'pipe',
        stderr: 'pipe'
    }
});
