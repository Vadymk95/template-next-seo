import { expect, test, type Page, type Request } from '@playwright/test';

const collectRscRequests = (page: Page) => {
    const requests: string[] = [];
    const listener = (req: Request) => {
        const url = req.url();
        if (url.includes('_rsc=') || req.headers()['rsc'] === '1') {
            requests.push(url);
        }
    };
    page.on('request', listener);
    return {
        stop: () => page.off('request', listener),
        list: requests
    };
};

test.describe('Navigation UX regressions', () => {
    test('clicking a link to the current route does not trigger an RSC fetch', async ({ page }) => {
        await page.goto('/en');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState('networkidle');

        const homeLink = page
            .getByRole('banner')
            .getByRole('navigation')
            .getByRole('link', { name: /^home$/i });
        await expect(homeLink).toHaveAttribute('aria-current', 'page');

        const rsc = collectRscRequests(page);
        await homeLink.click();
        await page.waitForTimeout(500);
        rsc.stop();

        expect(
            rsc.list,
            `Expected 0 RSC requests when clicking the already-active route, got:\n${rsc.list.join('\n')}`
        ).toHaveLength(0);
        await expect(page).toHaveURL(/\/en$/);
    });

    test('client-side navigation to a different route updates URL and heading', async ({
        page
    }) => {
        await page.goto('/en');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState('networkidle');

        await page
            .getByRole('banner')
            .getByRole('navigation')
            .getByRole('link', { name: /example form/i })
            .click();

        await expect(page).toHaveURL(/\/en\/example-form$/);
        await expect(page.getByRole('heading', { level: 1, name: /example form/i })).toBeVisible({
            timeout: 30_000
        });
    });

    test('loading indicator does not flash during fast client-side navigation', async ({
        page
    }) => {
        await page.goto('/en');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState('networkidle');

        const spinner = page.locator('[role="status"]');
        await page
            .getByRole('banner')
            .getByRole('navigation')
            .getByRole('link', { name: /example form/i })
            .click();

        const spinnerAppeared = await spinner
            .waitFor({ state: 'visible', timeout: 150 })
            .then(() => true)
            .catch(() => false);

        expect(
            spinnerAppeared,
            'Fullscreen spinner appeared during a fast client-side transition (UX regression).'
        ).toBe(false);
    });

    test('footer active-route link exposes aria-current and suppresses RSC fetch', async ({
        page
    }) => {
        await page.goto('/en');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState('networkidle');

        const footerHome = page.getByRole('contentinfo').getByRole('link', { name: /^home$/i });
        await expect(footerHome).toHaveAttribute('aria-current', 'page');

        const rsc = collectRscRequests(page);
        await footerHome.click();
        await page.waitForTimeout(500);
        rsc.stop();

        expect(
            rsc.list,
            `Expected 0 RSC requests from Footer click on active route, got:\n${rsc.list.join('\n')}`
        ).toHaveLength(0);
        await expect(page).toHaveURL(/\/en$/);
    });

    test('modifier-click on active route does not preventDefault (browser handles new tab)', async ({
        page
    }) => {
        await page.goto('/en');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState('networkidle');

        const homeLink = page
            .getByRole('banner')
            .getByRole('navigation')
            .getByRole('link', { name: /^home$/i });
        await expect(homeLink).toHaveAttribute('aria-current', 'page');

        const defaultPrevented = await homeLink.evaluate((el) => {
            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                metaKey: true,
                button: 0
            });
            el.dispatchEvent(event);
            return event.defaultPrevented;
        });

        expect(
            defaultPrevented,
            'SmartLink must NOT call preventDefault on modifier-click — browser should handle "open in new tab".'
        ).toBe(false);
        await expect(page).toHaveURL(/\/en$/);
    });
});
