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

/* The metric fields that reach the log, whatever page the beacon names. */
const LOGGED_METRIC = {
    name: 'LCP',
    value: 1234.5,
    delta: 1234.5,
    rating: 'good',
    navigationType: 'navigate'
};

/* The metric as logged for REPORTED: the page is the path of `navigationURL`, never the URL. */
const LOGGED = { ...LOGGED_METRIC, page: '/en' };

/* The longest path the log carries: a client chooses the path, so it is cut. */
const MAX_PAGE_LENGTH = 512;

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

    it('logs the page as a bare path: no query, no email, no origin', async () => {
        await POST(post(JSON.stringify(REPORTED)));

        const line = JSON.stringify(loggedCalls());
        expect(line).not.toContain('jane@example.com');
        expect(line).not.toContain('email=');
        expect(line).not.toContain('?');
        expect(line).not.toContain('localhost');
    });

    it.each([
        ['a query', 'http://localhost:3000/en?token=abc', '/en'],
        ['a hash', 'http://localhost:3000/en#token=abc', '/en'],
        ['credentials', 'http://u:p@localhost:3000/en', '/en'],
        ['another origin', 'https://example.com:8443/en/example-form', '/en/example-form'],
        ['no path after the origin', 'http://localhost:3000', '/']
    ])('reduces a navigation URL with %s to its path', async (_, navigationURL, page) => {
        await POST(post(JSON.stringify({ ...REPORTED, navigationURL })));

        expect(loggedCalls()).toStrictEqual([['[vitals]', { metric: { ...LOGGED_METRIC, page } }]]);
    });

    it('cuts a path longer than the limit to exactly the limit', async () => {
        const path = `/${'a'.repeat(MAX_PAGE_LENGTH + 88)}`;

        await POST(post(JSON.stringify({ ...REPORTED, navigationURL: `${ORIGIN}${path}` })));

        expect(loggedCalls()).toStrictEqual([
            ['[vitals]', { metric: { ...LOGGED_METRIC, page: path.slice(0, MAX_PAGE_LENGTH) } }]
        ]);
    });

    it('keeps a path of exactly the limit whole', async () => {
        const path = `/${'a'.repeat(MAX_PAGE_LENGTH - 1)}`;

        await POST(post(JSON.stringify({ ...REPORTED, navigationURL: `${ORIGIN}${path}` })));

        expect(loggedCalls()).toStrictEqual([
            ['[vitals]', { metric: { ...LOGGED_METRIC, page: path } }]
        ]);
    });

    it.each([
        ['missing', undefined],
        ['a number', 42],
        ['an object', { href: 'http://localhost:3000/en' }],
        ['text that is not a URL', 'not a url'],
        ['a relative path', '/en?x=1'],
        ['a mailto address', 'mailto:jane@example.com'],
        ['a javascript URL', 'javascript:alert(1)'],
        ['a data URL', 'data:text/plain,hi']
    ])(
        'logs the metric without a page, never the invalid marker, when navigationURL is %s',
        async (_, navigationURL) => {
            const res = await POST(post(JSON.stringify({ ...REPORTED, navigationURL })));

            expect(res.status).toBe(204);
            expect(loggedCalls()).toStrictEqual([['[vitals]', { metric: LOGGED_METRIC }]]);
        }
    );

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
