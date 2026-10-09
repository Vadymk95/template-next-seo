import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/shared/lib/logger';

import { POST } from './route';

vi.mock('@/shared/lib/logger', () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

const ORIGIN = 'http://localhost:3000';

const post = (body: string, headers: Record<string, string> = { origin: ORIGIN }): NextRequest =>
    new NextRequest(`${ORIGIN}/api/vitals`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body
    });

describe('POST /api/vitals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGIN);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns 204 with an empty body and logs the reported metric', async () => {
        const metric = { name: 'LCP', value: 1234.5, rating: 'good' };

        const res = await POST(post(JSON.stringify(metric)));

        expect(res.status).toBe(204);
        expect(res.body).toBeNull();
        expect(vi.mocked(logger.info)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(logger.info)).toHaveBeenCalledWith('[vitals]', { metric });
    });

    it.each([
        ['a number', '42', 42],
        ['a string', '"slow"', 'slow'],
        ['null', 'null', null]
    ])('wraps %s in a value field so the logged metric stays an object', async (_, raw, value) => {
        const res = await POST(post(raw));

        expect(res.status).toBe(204);
        expect(vi.mocked(logger.info)).toHaveBeenCalledWith('[vitals]', { metric: { value } });
    });

    it('still answers 204 and flags the parse error when the body is not JSON', async () => {
        const res = await POST(post('{not json'));

        expect(res.status).toBe(204);
        expect(vi.mocked(logger.info)).toHaveBeenCalledWith('[vitals]', {
            metric: { parseError: true }
        });
    });

    it('returns 403 and logs nothing when Origin is missing', async () => {
        const res = await POST(post('{"name":"LCP"}', {}));

        expect(res.status).toBe(403);
        expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
    });

    it('returns 403 and logs nothing for a cross-site Origin', async () => {
        const res = await POST(post('{"name":"LCP"}', { origin: 'https://evil.example' }));

        expect(res.status).toBe(403);
        expect(vi.mocked(logger.info)).not.toHaveBeenCalled();
    });
});
