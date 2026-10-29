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

/* What `useReportWebVitals` posts: a web-vitals Metric serialized whole, page URLs included. */
const REPORTED = {
    name: 'LCP',
    value: 1234.5,
    rating: 'good',
    delta: 1234.5,
    id: 'v6-1700000000000-1234567890123',
    entries: [
        { name: 'http://localhost:3000/en?token=abc', entryType: 'largest-contentful-paint' }
    ],
    navigationType: 'navigate',
    navigationId: 0,
    navigationURL: 'http://localhost:3000/en?email=jane@example.com',
    navigationStartTime: 0
};

/* The only fields of a metric that reach the log. */
const LOGGED = {
    name: 'LCP',
    value: 1234.5,
    delta: 1234.5,
    rating: 'good',
    navigationType: 'navigate'
};

const INVALID_MARKER = { invalid: true };

const loggedCalls = () => vi.mocked(logger.info).mock.calls;

describe('POST /api/vitals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGIN);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns 204 with an empty body and logs only the validated fields of the metric', async () => {
        const res = await POST(post(JSON.stringify(REPORTED)));

        expect(res.status).toBe(204);
        expect(res.body).toBeNull();
        expect(loggedCalls()).toStrictEqual([['[vitals]', { metric: LOGGED }]]);
    });

    it.each([
        ['an email', { email: 'jane@example.com' }],
        ['a URL', { url: 'https://example.com/account?token=abc' }],
        ['a nested object', { attribution: { element: '#card', url: 'https://example.com/a' } }]
    ])('does not carry %s sent along with the metric into the log', async (_, extra) => {
        await POST(post(JSON.stringify({ ...REPORTED, ...extra })));

        expect(loggedCalls()).toStrictEqual([['[vitals]', { metric: LOGGED }]]);
    });

    it.each(['CLS', 'FCP', 'INP', 'LCP', 'TTFB'])('accepts the %s metric', async (name) => {
        await POST(post(JSON.stringify({ ...REPORTED, name })));

        expect(loggedCalls()).toStrictEqual([['[vitals]', { metric: { ...LOGGED, name } }]]);
    });

    it.each(['good', 'needs-improvement', 'poor'])('accepts the %s rating', async (rating) => {
        await POST(post(JSON.stringify({ ...REPORTED, rating })));

        expect(loggedCalls()).toStrictEqual([['[vitals]', { metric: { ...LOGGED, rating } }]]);
    });

    it.each([
        'navigate',
        'reload',
        'back-forward',
        'back-forward-cache',
        'prerender',
        'restore',
        'soft-navigation'
    ])('accepts the %s navigation type', async (navigationType) => {
        await POST(post(JSON.stringify({ ...REPORTED, navigationType })));

        expect(loggedCalls()).toStrictEqual([
            ['[vitals]', { metric: { ...LOGGED, navigationType } }]
        ]);
    });

    it.each([
        ['garbage JSON', '{not json'],
        ['a number', '42'],
        ['a string', '"slow"'],
        ['null', 'null'],
        ['an array', '[]'],
        ['an empty object', '{}'],
        ['a name outside the metric set', JSON.stringify({ ...REPORTED, name: 'FID' })],
        ['an email as the name', JSON.stringify({ ...REPORTED, name: 'jane@example.com' })],
        ['a rating outside the set', JSON.stringify({ ...REPORTED, rating: 'excellent' })],
        [
            'a navigation type outside the set',
            JSON.stringify({ ...REPORTED, navigationType: 'teleport' })
        ],
        ['a value sent as text', JSON.stringify({ ...REPORTED, value: '1234.5' })],
        ['a delta sent as text', JSON.stringify({ ...REPORTED, delta: '1234.5' })],
        [
            'a value that is not finite',
            JSON.stringify(REPORTED).replace('"value":1234.5', '"value":1e999')
        ]
    ])('logs only the invalid marker for %s and still answers 204', async (_, raw) => {
        const res = await POST(post(raw));

        expect(res.status).toBe(204);
        expect(loggedCalls()).toStrictEqual([['[vitals]', INVALID_MARKER]]);
    });

    it.each(['name', 'value', 'delta', 'rating', 'navigationType'])(
        'logs only the invalid marker when %s is missing',
        async (field) => {
            const { [field]: _omitted, ...rest } = REPORTED as Record<string, unknown>;

            const res = await POST(post(JSON.stringify(rest)));

            expect(res.status).toBe(204);
            expect(loggedCalls()).toStrictEqual([['[vitals]', INVALID_MARKER]]);
        }
    );

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
