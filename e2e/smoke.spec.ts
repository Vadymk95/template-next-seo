import { expect, test } from '@playwright/test';

import { expectNoSevereA11yViolations } from '@/e2e/support/a11y';

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
});
