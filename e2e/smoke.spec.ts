import type { ConsoleMessage } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { expectNoSevereA11yViolations } from '@/e2e/support/a11y';

const ROUTES_WITHOUT_ERRORS = ['/en', '/en/example-form'] as const;

test.describe('Smoke', () => {
    test('home page loads with localized document title', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/en$/);
        await expect(page).toHaveTitle(/Home \| React Enterprise Foundation/);
    });

    test('home exposes main landmark after shell is ready', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
        await expectNoSevereA11yViolations(page);
    });

    test('a page load logs no error and loads no stylesheet as a script', async ({ page }) => {
        // The web-vitals beacon is first-party telemetry behind the API rate limiter. A suite that
        // shares one server and one client identity can exhaust that limiter, and the browser then
        // logs a 429 console error that says nothing about the page under test. Answer the beacon
        // here so this check does not depend on how many requests ran before it.
        await page.route('**/api/vitals', (route) => route.fulfill({ status: 204 }));

        for (const path of ROUTES_WITHOUT_ERRORS) {
            const consoleErrors: string[] = [];
            const pageErrors: string[] = [];
            const onConsole = (message: ConsoleMessage): void => {
                if (message.type() === 'error') {
                    // The failing resource is named only by its location, not by the message text.
                    consoleErrors.push(`${message.text()} (${message.location().url})`);
                }
            };
            const onPageError = (error: Error): void => {
                pageErrors.push(error.message);
            };

            page.on('console', onConsole);
            page.on('pageerror', onPageError);
            await page.goto(path, { waitUntil: 'load' });
            page.off('console', onConsole);
            page.off('pageerror', onPageError);

            // A stylesheet in a script tag is refused under `X-Content-Type-Options: nosniff` (text/css
            // is not executable), so the page still renders and the only symptom is one console error
            // on every load. The vendor `splitChunks` groups in `next.config.ts` are what put it there.
            const scriptSources = await page
                .locator('script[src]')
                .evaluateAll((scripts) => scripts.map((script) => script.getAttribute('src')));
            expect
                .soft(
                    scriptSources.filter((src) => src?.split('?')[0]?.endsWith('.css')),
                    `${path} stylesheets loaded as scripts`
                )
                .toEqual([]);
            expect.soft(consoleErrors, `${path} console errors`).toEqual([]);
            expect.soft(pageErrors, `${path} uncaught errors`).toEqual([]);
        }
    });

    test('a page opens no connection to a third-party origin before any consent', async ({
        page
    }) => {
        // `next/font` serves Google Fonts from this origin and the CSP allows no other `font-src`, and
        // nothing here loads a tag manager, so a `preconnect` or `dns-prefetch` hint to a third party
        // only makes the browser contact that host on every page view, before anyone has consented.
        for (const path of ROUTES_WITHOUT_ERRORS) {
            await page.goto(path, { waitUntil: 'load' });

            const hinted = await page
                .locator('link[rel~="preconnect" i], link[rel~="dns-prefetch" i]')
                .evaluateAll((links) =>
                    links.map(
                        (link) => new URL(link.getAttribute('href') ?? '', location.href).origin
                    )
                );
            const foreign = hinted.filter((origin) => origin !== new URL(page.url()).origin);

            expect.soft(foreign, `${path} connection hints to other origins`).toEqual([]);
        }
    });

    test('each page states its own social preview, and the image it names is served', async ({
        page,
        request
    }) => {
        // A page's `openGraph` replaces the layout's whole object (metadata merges one key deep), so a
        // page that does not state its own title and url shares the home page's preview.
        const previews = [];
        for (const path of ROUTES_WITHOUT_ERRORS) {
            await page.goto(path, { waitUntil: 'load' });

            // Read from the DOM so a missing tag is a null to assert on, not a 30 s locator timeout.
            const meta = (property: string): Promise<string | null> =>
                page.evaluate(
                    (name) =>
                        document
                            .querySelector(`meta[property="${name}"]`)
                            ?.getAttribute('content') ?? null,
                    property
                );
            previews.push({
                path,
                title: await meta('og:title'),
                url: await meta('og:url'),
                image: await meta('og:image')
            });
        }

        const [home, form] = previews;
        expect(home?.title, 'home og:title').toBeTruthy();
        expect(form?.title, 'example-form og:title').toBeTruthy();
        expect(form?.title).not.toBe(home?.title);
        expect(form?.url).not.toBe(home?.url);
        expect(new URL(form?.url ?? '').pathname).toBe('/en/example-form');

        for (const preview of previews) {
            expect(preview.image, `${preview.path} og:image`).toBeTruthy();
            const response = await request.get(new URL(preview.image ?? '').pathname);
            expect(response.status(), `${preview.path} og:image status`).toBe(200);
            expect(response.headers()['content-type']).toBe('image/png');
        }
    });
});
