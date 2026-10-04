import { expect, test } from '@playwright/test';

import { expectNoSevereA11yViolations } from '@/e2e/support/a11y';

test.describe('Example form page', () => {
    test('renders heading and form fields', async ({ page }) => {
        await page.goto('/en/example-form');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByLabel(/name/i)).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expectNoSevereA11yViolations(page);
    });
});
