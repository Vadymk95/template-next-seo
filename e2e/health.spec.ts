import { expect, test } from '@playwright/test';

test.describe('Health API', () => {
    test('returns JSON from GET /api/health', async ({ request }) => {
        const res = await request.get('/api/health');
        expect(res.ok()).toBeTruthy();
        const json = (await res.json()) as { status?: string };
        expect(json.status).toBe('ok');
    });
});
