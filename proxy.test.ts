import { createHash } from 'node:crypto';

import { getIsPossibleServerAction } from 'next/dist/server/lib/server-action-request-meta';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/middleware', async () => {
    const { NextResponse } = await import('next/server');
    return { default: () => () => NextResponse.next() };
});

vi.mock('@/shared/lib/upstashRateLimit', () => ({
    getUpstashRatelimit: vi.fn(() => null)
}));

vi.mock('@/shared/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { logger } from '@/shared/lib/logger';
import { getUpstashRatelimit } from '@/shared/lib/upstashRateLimit';

import { proxy } from './proxy';

const PAGE_URL = 'http://localhost:3000/en/example-form';
const API_URL = 'http://localhost:3000/api/health';
const URL_ENCODED = 'application/x-www-form-urlencoded';
const MULTIPART = 'multipart/form-data; boundary=----proxy-test';

const buildRequest = (method: string, url: string, headers: Record<string, string> = {}) =>
    new NextRequest(url, { method, headers: { 'user-agent': 'proxy-test-actions', ...headers } });

/* Whether the proxy put the request through the rate limiter; the Upstash `limit` call is the probe. */
const isRateLimited = async (request: NextRequest): Promise<boolean> => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(getUpstashRatelimit).mockReturnValue({ limit } as never);
    await proxy(request);
    return limit.mock.calls.length > 0;
};

/* Requests to a document route, and whether Next runs each one as a Server Action. */
const PAGE_REQUESTS: [
    name: string,
    method: string,
    headers: Record<string, string>,
    run: boolean
][] = [
    ['a POST carrying next-action', 'POST', { 'next-action': 'abc123' }, true],
    ['a POST with an empty next-action header', 'POST', { 'next-action': '' }, true],
    ['a header-less multipart POST', 'POST', { 'content-type': MULTIPART }, true],
    ['a header-less urlencoded POST', 'POST', { 'content-type': URL_ENCODED }, true],
    ['a JSON POST', 'POST', { 'content-type': 'application/json' }, false],
    ['a plain-text POST', 'POST', { 'content-type': 'text/plain' }, false],
    ['a POST without a content type', 'POST', {}, false],
    [
        'a urlencoded POST with a charset parameter',
        'POST',
        { 'content-type': `${URL_ENCODED}; charset=UTF-8` },
        false
    ],
    ['a GET', 'GET', {}, false],
    ['a GET carrying next-action', 'GET', { 'next-action': 'abc123' }, false],
    ['a multipart GET', 'GET', { 'content-type': MULTIPART }, false],
    ['a urlencoded PUT', 'PUT', { 'content-type': URL_ENCODED }, false]
];

describe('proxy', () => {
    beforeEach(() => {
        vi.mocked(getUpstashRatelimit).mockReset();
        vi.mocked(getUpstashRatelimit).mockReturnValue(null);
        vi.mocked(logger.error).mockClear();
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'none');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('short-circuits asset-like API paths without applying proxy CSP', async () => {
        const res = await proxy(
            new NextRequest('http://localhost:3000/api/chunk.js', {
                headers: { 'user-agent': 'proxy-test-assets' }
            })
        );
        expect(res.headers.get('content-security-policy')).toBeNull();
    });

    it('returns 404 for /dev in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await proxy(
            new NextRequest('http://localhost:3000/dev/ui', {
                headers: { 'user-agent': 'proxy-test-dev-block' }
            })
        );
        expect(res.status).toBe(404);
    });

    it('applies nonce-based CSP on API responses in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await proxy(
            new NextRequest('http://localhost:3000/api/health', {
                headers: { 'user-agent': 'proxy-test-csp' }
            })
        );
        const csp = res.headers.get('content-security-policy');
        expect(csp).toBeTruthy();
        expect(csp).toContain("'strict-dynamic'");
        expect(csp).toContain("'nonce-");
    });

    it('returns 429 after exceeding the in-memory window', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const ua = 'proxy-test-rl-window-unique';
        const mk = () =>
            new NextRequest('http://localhost:3000/api/health', {
                headers: { 'user-agent': ua }
            });
        for (let i = 0; i < 100; i++) {
            const res = await proxy(mk());
            expect(res.status).not.toBe(429);
        }
        const blocked = await proxy(mk());
        expect(blocked.status).toBe(429);
    });

    it('uses Upstash when configured', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const limit = vi.fn().mockResolvedValue({ success: true });
        vi.mocked(getUpstashRatelimit).mockReturnValue({ limit } as never);
        await proxy(
            new NextRequest('http://localhost:3000/api/health', {
                headers: { 'user-agent': 'proxy-test-upstash' }
            })
        );
        expect(limit).toHaveBeenCalledTimes(1);
    });

    describe('Server Action rate limit', () => {
        it.each(PAGE_REQUESTS)('for %s to a page', async (_name, method, headers, run) => {
            expect(await isRateLimited(buildRequest(method, PAGE_URL, headers))).toBe(run);
        });

        it.each(PAGE_REQUESTS)(
            'agrees with Next on %s to a page',
            async (_name, method, headers) => {
                const request = buildRequest(method, PAGE_URL, headers);

                expect(await isRateLimited(request)).toBe(getIsPossibleServerAction(request));
            }
        );

        it.each([
            ['a JSON POST', 'POST', { 'content-type': 'application/json' }],
            ['a GET', 'GET', {}]
        ])('still limits %s to an API route', async (_name, method, headers) => {
            expect(await isRateLimited(buildRequest(method, API_URL, headers))).toBe(true);
        });

        it.each([
            ['a header-less multipart POST', MULTIPART],
            ['a header-less urlencoded POST', URL_ENCODED]
        ])('answers %s with 429 once the limiter refuses', async (_name, contentType) => {
            const limit = vi.fn().mockResolvedValue({ success: false });
            vi.mocked(getUpstashRatelimit).mockReturnValue({ limit } as never);

            const res = await proxy(
                buildRequest('POST', PAGE_URL, { 'content-type': contentType })
            );

            expect(res.status).toBe(429);
            await expect(res.json()).resolves.toEqual({ error: 'Too many requests' });
        });

        it('counts a header-less multipart POST in the in-memory window', async () => {
            const mk = () =>
                new NextRequest(PAGE_URL, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'proxy-test-form-window-unique',
                        'content-type': MULTIPART
                    }
                });
            for (let i = 0; i < 100; i++) {
                const res = await proxy(mk());
                expect(res.status).not.toBe(429);
            }
            const blocked = await proxy(mk());
            expect(blocked.status).toBe(429);
        });
    });

    describe('when Upstash fails', () => {
        const failUpstash = (error = new Error('upstash down')) => {
            const limit = vi.fn().mockRejectedValue(error);
            vi.mocked(getUpstashRatelimit).mockReturnValue({ limit } as never);
        };

        const loggedHints = () => vi.mocked(logger.error).mock.calls.map((call) => call[2]);

        const failFor = async (forwardedFor: string, error?: Error) => {
            vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'first-hop');
            failUpstash(error);
            await proxy(
                new NextRequest(API_URL, {
                    headers: { 'x-forwarded-for': forwardedFor, 'user-agent': 'proxy-test-hint' }
                })
            );
        };

        it('falls back to the in-memory window and logs each failure', async () => {
            failUpstash();
            const mk = () =>
                new NextRequest(API_URL, {
                    headers: { 'user-agent': 'proxy-test-fallback-unique' }
                });
            for (let i = 0; i < 100; i++) {
                const res = await proxy(mk());
                expect(res.status).not.toBe(429);
            }
            const blocked = await proxy(mk());

            expect(blocked.status).toBe(429);
            expect(logger.error).toHaveBeenCalledTimes(101);
        });

        it.each([
            ['an IPv4', '203.0.113.7', '203.0.113'],
            ['an IPv6', '2001:db8:85a3::8a2e:370:7334', '2001:db8']
        ])('keeps %s client address out of the log', async (_name, address, fragment) => {
            await failFor(address);

            expect(logger.error).toHaveBeenCalledTimes(1);
            const logged = JSON.stringify(vi.mocked(logger.error).mock.calls[0]);
            expect(logged).not.toContain(address);
            expect(logged).not.toContain(fragment);
            expect(loggedHints()).toEqual([{ keyHint: expect.stringMatching(/^ip:[0-9a-f]{8}$/) }]);
        });

        it.each([
            ['an IPv4', '203.0.113.7', '203.0.113'],
            ['an IPv6', '2001:db8:85a3::8a2e:370:7334', '2001:db8']
        ])(
            'keeps %s client address out of the error text the Upstash client builds',
            async (_name, address, fragment) => {
                // @upstash/redis appends the failed command, which holds the key, to its error text.
                const upstashError = new Error(
                    `ERR script failed, command was: ["evalsha","c0ffee",1,"template-next-seo:ratelimit:ip:${address}:42"]`
                );
                upstashError.name = 'UpstashError';

                await failFor(address, upstashError);

                const [, logged] = vi.mocked(logger.error).mock.calls[0] ?? [];
                const { name, message, stack = '' } = logged!;
                const text = `${message}\n${stack}`;
                expect(name).toBe('UpstashError');
                expect(message).toContain('ERR script failed');
                expect(stack).toContain('ERR script failed');
                expect(text).not.toContain(address);
                expect(text).not.toContain(fragment);
            }
        );

        it('logs the kind of an anonymous key without the user agent', async () => {
            failUpstash();
            await proxy(new NextRequest(API_URL, { headers: { 'user-agent': 'proxy-test-anon' } }));

            expect(loggedHints()).toEqual([
                { keyHint: expect.stringMatching(/^anon:[0-9a-f]{8}$/) }
            ]);
            expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).not.toContain(
                'proxy-test-anon'
            );
        });

        it('gives one client the same hint every time and another client a different one', async () => {
            await failFor('203.0.113.21');
            await failFor('203.0.113.21');
            await failFor('203.0.113.22');

            const [first, again, other] = loggedHints();
            expect(first).toEqual(again);
            expect(first).not.toEqual(other);
        });

        it('does not log a bare hash of the key, which trying every address would reverse', async () => {
            await failFor('203.0.113.9');

            const bare = createHash('sha256').update('ip:203.0.113.9').digest('hex').slice(0, 8);
            expect(loggedHints()).not.toContainEqual({ keyHint: `ip:${bare}` });
        });
    });
});
