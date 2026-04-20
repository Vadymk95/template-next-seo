import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
    test('home page loads with localized document title', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/en$/);
        await expect(page).toHaveTitle(/Home \| React Enterprise Foundation/);
    });

    test('home exposes main landmark after shell is ready', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
    });
});
