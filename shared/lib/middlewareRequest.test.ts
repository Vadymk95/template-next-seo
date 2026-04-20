import { describe, expect, it } from 'vitest';

import { getRateLimitKey, isAssetPath } from './middlewareRequest';

function headersFrom(init: Record<string, string>): { get(name: string): string | null } {
    const lower = new Map(Object.entries(init).map(([k, v]) => [k.toLowerCase(), v] as const));
    return {
        get(name: string) {
            return lower.get(name.toLowerCase()) ?? null;
        }
    };
}

describe('getRateLimitKey', () => {
    it('prefers the first IP from x-vercel-forwarded-for over x-forwarded-for', () => {
        const h = headersFrom({
            'x-vercel-forwarded-for': '10.0.0.1, 10.0.0.2',
            'x-forwarded-for': '203.0.113.9, 198.51.100.1'
        });
        expect(getRateLimitKey(h)).toBe('ip:10.0.0.1');
    });

    it('uses the last x-forwarded-for hop when vercel header is absent', () => {
        const h = headersFrom({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' });
        expect(getRateLimitKey(h)).toBe('ip:203.0.113.9');
    });

    it('falls back to x-real-ip then anonymous UA prefix', () => {
        expect(getRateLimitKey(headersFrom({ 'x-real-ip': '192.0.2.1' }))).toBe('ip:192.0.2.1');
        const ua = 'a'.repeat(80);
        expect(getRateLimitKey(headersFrom({ 'user-agent': ua }))).toBe(`anon:${'a'.repeat(64)}`);
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
