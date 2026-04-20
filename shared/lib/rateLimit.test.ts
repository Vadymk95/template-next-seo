import { beforeEach, describe, expect, it } from 'vitest';

import { checkRateLimit, pruneAndCapRateLimitMap, type RateLimitRecord } from './rateLimitCore';

describe('pruneAndCapRateLimitMap', () => {
    let map: Map<string, RateLimitRecord>;

    beforeEach(() => {
        map = new Map();
    });

    it('removes expired entries', () => {
        map.set('a', { count: 1, resetTime: 100 });
        map.set('b', { count: 1, resetTime: 200 });
        pruneAndCapRateLimitMap(map, 150);
        expect(map.has('a')).toBe(false);
        expect(map.has('b')).toBe(true);
    });

    it('keeps entries when now equals resetTime (strictly greater prunes)', () => {
        map.set('a', { count: 1, resetTime: 100 });
        pruneAndCapRateLimitMap(map, 100);
        expect(map.has('a')).toBe(true);
    });

    it('evicts oldest resetTime when over maxKeys', () => {
        const now = 1_000_000;
        for (let i = 0; i < 6; i++) {
            map.set(`k${i}`, { count: 1, resetTime: now + 60_000 + i });
        }
        pruneAndCapRateLimitMap(map, now, 5);
        expect(map.size).toBe(5);
        expect(map.has('k0')).toBe(false);
    });
});

describe('checkRateLimit', () => {
    let map: Map<string, RateLimitRecord>;

    beforeEach(() => {
        map = new Map();
    });

    it('allows up to maxRequests in window', () => {
        const now = 5_000;
        const windowMs = 60_000;
        expect(checkRateLimit(map, 'ip', now, windowMs, 3)).toBe(true);
        expect(checkRateLimit(map, 'ip', now + 1, windowMs, 3)).toBe(true);
        expect(checkRateLimit(map, 'ip', now + 2, windowMs, 3)).toBe(true);
        expect(checkRateLimit(map, 'ip', now + 3, windowMs, 3)).toBe(false);
    });

    it('resets after window elapses', () => {
        const t0 = 10_000;
        const windowMs = 1_000;
        expect(checkRateLimit(map, 'x', t0, windowMs, 1)).toBe(true);
        expect(checkRateLimit(map, 'x', t0 + 100, windowMs, 1)).toBe(false);
        expect(checkRateLimit(map, 'x', t0 + windowMs + 1, windowMs, 1)).toBe(true);
    });
});
