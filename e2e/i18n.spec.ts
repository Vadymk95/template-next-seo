import { expect, test } from '@playwright/test';

import { ROUTES } from '@/app/sitemap';
import { routing } from '@/i18n/routing';

const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('i18n SSR routing', () => {
    test('unprefixed root redirects to default locale', async ({ request }) => {
        const response = await request.get('/', { maxRedirects: 0 });
        expect(response.status()).toBe(307);
        expect(response.headers()['location']).toMatch(/\/en$/);
    });

    test('localized home renders translated h1 and html lang', async ({ page }) => {
        await page.goto('/en');
        const html = page.locator('html');
        await expect(html).toHaveAttribute('lang', 'en');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'A Next.js foundation with the gate already wired'
        );
    });

    test('localized example-form page renders translated h1', async ({ page }) => {
        await page.goto('/en/example-form');
        await expect(page.getByRole('heading', { level: 1, name: 'Example Form' })).toBeVisible();
    });

    // The routes and the locales come from the code that builds the sitemap, so a route added there
    // is expected here without an edit, and a route the XML leaves out fails.
    test('sitemap.xml emits xhtml:link hreflang entries per route', async ({ request }) => {
        const response = await request.get('/sitemap.xml');
        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
        for (const locale of routing.locales) {
            for (const { path } of ROUTES) {
                // The closing quote after the path keeps `/en` from matching `/en/example-form`.
                const href = `/${locale}${path}`;
                expect(body, href).toMatch(
                    new RegExp(
                        `<xhtml:link[^/]*rel="alternate"[^/]*hreflang="${locale}"[^/]*href="[^"]+${escapeRegExp(href)}"`
                    )
                );
            }
        }
        // Every URL carries one alternate per locale: a route in ROUTES that the XML lacks, or one
        // the XML adds, changes the count.
        const alternates = body.match(/<xhtml:link /g) ?? [];
        expect(alternates).toHaveLength(ROUTES.length * routing.locales.length ** 2);
    });
});
