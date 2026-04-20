import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getRateLimitKey,
    isAssetPath,
    resolveTrustedProxyMode,
    type RateLimitRequestLike
} from './middlewareRequest';

function headersFrom(init: Record<string, string>): { get(name: string): string | null } {
    const lower = new Map(Object.entries(init).map(([k, v]) => [k.toLowerCase(), v] as const));
    return {
        get(name: string) {
            return lower.get(name.toLowerCase()) ?? null;
        }
    };
}

function req(init: Record<string, string>, ip?: string | null): RateLimitRequestLike {
    const headers = headersFrom(init);
    if (ip === undefined) {
        return { headers };
    }
    return { headers, ip };
}

describe('resolveTrustedProxyMode', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns explicit RATE_LIMIT_TRUST_PROXY when set', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'first-hop');
        vi.stubEnv('VERCEL', undefined);
        expect(resolveTrustedProxyMode()).toBe('first-hop');
    });

    it('defaults to vercel on Vercel when unset', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', undefined);
        vi.stubEnv('VERCEL', '1');
        expect(resolveTrustedProxyMode()).toBe('vercel');
    });

    it('defaults to none off Vercel when unset', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', undefined);
        vi.stubEnv('VERCEL', undefined);
        expect(resolveTrustedProxyMode()).toBe('none');
    });
});

describe('getRateLimitKey', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('in none mode ignores XFF and uses socket ip', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'none');
        const key = req(
            { 'x-forwarded-for': '203.0.113.9, 198.51.100.1', 'user-agent': 'ua' },
            '192.0.2.10'
        );
        expect(getRateLimitKey(key)).toBe('ip:192.0.2.10');
    });

    it('in none mode falls back to anonymous when ip is missing', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'none');
        const ua = 'b'.repeat(80);
        expect(getRateLimitKey(req({ 'x-forwarded-for': '203.0.113.9', 'user-agent': ua }))).toBe(
            `anon:${'b'.repeat(64)}`
        );
    });

    it('in vercel mode uses only x-vercel-forwarded-for first hop', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'vercel');
        expect(
            getRateLimitKey(
                req({
                    'x-vercel-forwarded-for': '10.0.0.1, 10.0.0.2',
                    'x-forwarded-for': '203.0.113.9, 198.51.100.1'
                })
            )
        ).toBe('ip:10.0.0.1');
    });

    it('in vercel mode does not use XFF when vercel header is absent', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'vercel');
        expect(
            getRateLimitKey(req({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' }, '192.0.2.1'))
        ).toBe('ip:192.0.2.1');
    });

    it('in first-hop mode accepts a single XFF hop', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'first-hop');
        expect(getRateLimitKey(req({ 'x-forwarded-for': '198.51.100.1' }))).toBe('ip:198.51.100.1');
    });

    it('in first-hop mode uses leftmost XFF client for multi-hop chains', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'first-hop');
        expect(
            getRateLimitKey(req({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9, 192.0.2.1' }))
        ).toBe('ip:198.51.100.1');
    });

    it('in first-hop mode falls back to socket ip when XFF is absent', () => {
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'first-hop');
        expect(getRateLimitKey(req({}, '192.0.2.44'))).toBe('ip:192.0.2.44');
    });
});

describe('isAssetPath', () => {
    it('treats Next asset prefixes and common static extensions as assets', () => {
        expect(isAssetPath('/_next/static/chunks/main.js')).toBe(true);
        expect(isAssetPath('/_next/image')).toBe(true);
        expect(isAssetPath('/fonts/foo.woff2')).toBe(true);
        expect(isAssetPath('/blog/post')).toBe(false);
    });
});
