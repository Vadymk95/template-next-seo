import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
    test('home page loads with expected document title', async ({ page }) => {
        await page.goto('/');
        // Matches `app/page.tsx` metadata.title ("Home"); layout template may not appear in <title> in all Next versions.
        await expect(page).toHaveTitle(/^Home$/);
    });

    test('home exposes main landmark after shell is ready', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
    });
});
