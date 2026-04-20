import { expect, test } from '@playwright/test';

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
            'Welcome to Next.js SEO Template'
        );
    });

    test('localized example-form page renders translated h1', async ({ page }) => {
        await page.goto('/en/example-form');
        await expect(page.getByRole('heading', { level: 1, name: 'Example Form' })).toBeVisible();
    });

    test('sitemap.xml emits xhtml:link hreflang entries per route', async ({ request }) => {
        const response = await request.get('/sitemap.xml');
        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
        expect(body).toMatch(
            /<xhtml:link[^/]*rel="alternate"[^/]*hreflang="en"[^/]*href="[^"]+\/en"/
        );
        expect(body).toMatch(
            /<xhtml:link[^/]*rel="alternate"[^/]*hreflang="en"[^/]*href="[^"]+\/en\/example-form"/
        );
    });
});
