import { expect, test, type Page } from '@playwright/test';

/**
 * Turbopack dev smoke. The production gate builds with webpack, so a crash that
 * only reproduces under the dev bundler ships unnoticed. These specs are about the
 * BUNDLER, not the features — keep them shallow and cheap, and assert the thing a
 * production run cannot see: a clean console on a Turbopack render.
 */

const DOCUMENT_ROUTES = ['/en', '/en/example-form', '/dev/ui'] as const;

// The browser logs the document's own non-2xx status as a console error. That is
// an echo of the HTTP status we already assert, not an application fault, so it
// must not make a deliberate 404 look like a crash.
const isStatusEcho = (text: string): boolean =>
    /Failed to load resource: the server responded with a status of \d{3}/.test(text);

const visitWithoutApplicationErrors = async (
    page: Page,
    path: string,
    expectedStatus: number
): Promise<void> => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    const onConsole = (message: { type: () => string; text: () => string }): void => {
        if (message.type() === 'error' && !isStatusEcho(message.text())) {
            consoleErrors.push(message.text());
        }
    };
    const onPageError = (error: Error): void => {
        pageErrors.push(error.message);
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    const response = await page.goto(path);
    page.off('console', onConsole);
    page.off('pageerror', onPageError);

    expect(response?.status(), `status for ${path}`).toBe(expectedStatus);
    expect(consoleErrors, `console errors on ${path}`).toEqual([]);
    expect(pageErrors, `uncaught errors on ${path}`).toEqual([]);
};

test.describe('Turbopack dev smoke', () => {
    test('renders every document route without application errors', async ({ page }) => {
        for (const path of DOCUMENT_ROUTES) {
            await visitWithoutApplicationErrors(page, path, 200);
        }
    });

    test('keeps the locale redirect and the 404 boundary clean', async ({ page, request }) => {
        // The unprefixed root is a next-intl redirect, which is proxy work — the
        // layer most likely to behave differently between bundlers.
        const redirected = await request.get('/', { maxRedirects: 0 });
        expect([307, 308]).toContain(redirected.status());
        expect(redirected.headers().location).toContain('/en');

        await visitWithoutApplicationErrors(page, '/', 200);
        await visitWithoutApplicationErrors(page, '/en/definitely-missing', 404);
    });

    test('serves the SEO surfaces under the dev bundler', async ({ request }) => {
        const sitemap = await request.get('/sitemap.xml');
        expect(sitemap.status()).toBe(200);
        expect(await sitemap.text()).toContain('<urlset');

        // `app/robots.ts` deliberately returns a dev-only `disallow: /` with NO
        // sitemap line, so a dev server never advertises a crawlable site. Asserting
        // the dev shape pins that on purpose: a production robots served from dev
        // would be the actual defect here.
        const robots = await request.get('/robots.txt');
        expect(robots.status()).toBe(200);
        const robotsBody = await robots.text();
        expect(robotsBody).toContain('Disallow: /');
        expect(robotsBody).not.toContain('Sitemap:');
    });
});
