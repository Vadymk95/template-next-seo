import { beforeEach, describe, expect, it } from 'vitest';

import { checkRateLimit, pruneAndCapRateLimitMap, type RateLimitRecord } from './rateLimitCore';

const WINDOW_MS = 60_000;
const DEFAULT_MAX_KEYS = 5_000;

describe('pruneAndCapRateLimitMap', () => {
    let map: Map<string, RateLimitRecord>;

    beforeEach(() => {
        map = new Map();
    });

    it('does nothing to an empty map', () => {
        pruneAndCapRateLimitMap(map, 1_000);

        expect(map.size).toBe(0);
    });

    it('removes every expired record and keeps every live one', () => {
        map.set('expired-a', { count: 1, resetTime: 100 });
        map.set('live-a', { count: 2, resetTime: 500 });
        map.set('expired-b', { count: 3, resetTime: 149 });
        map.set('live-b', { count: 4, resetTime: 151 });

        pruneAndCapRateLimitMap(map, 150);

        expect([...map.keys()].sort()).toEqual(['live-a', 'live-b']);
        expect(map.get('live-a')).toEqual({ count: 2, resetTime: 500 });
        expect(map.get('live-b')).toEqual({ count: 4, resetTime: 151 });
    });

    it('keeps a record whose window ends exactly now, only a strictly later now expires it', () => {
        map.set('edge', { count: 1, resetTime: 100 });

        pruneAndCapRateLimitMap(map, 100);
        expect(map.has('edge')).toBe(true);

        pruneAndCapRateLimitMap(map, 101);
        expect(map.has('edge')).toBe(false);
    });

    it('leaves a map at exactly maxKeys untouched', () => {
        for (let i = 0; i < 5; i++) {
            map.set(`k${String(i)}`, { count: 1, resetTime: 10_000 + i });
        }

        pruneAndCapRateLimitMap(map, 0, 5);

        expect(map.size).toBe(5);
    });

    it('evicts exactly the overflow, oldest window first, whatever the insertion order', () => {
        // Inserted newest-first, so the eviction order can only come from sorting by resetTime.
        map.set('t5', { count: 1, resetTime: 5_000 });
        map.set('t4', { count: 1, resetTime: 4_000 });
        map.set('t3', { count: 1, resetTime: 3_000 });
        map.set('t2', { count: 1, resetTime: 2_000 });
        map.set('t1', { count: 1, resetTime: 1_000 });

        pruneAndCapRateLimitMap(map, 0, 3);

        expect([...map.keys()].sort()).toEqual(['t3', 't4', 't5']);
    });

    it('counts only live records against maxKeys, so expiry runs before the cap', () => {
        map.set('expired-a', { count: 1, resetTime: 1 });
        map.set('expired-b', { count: 1, resetTime: 2 });
        map.set('live-a', { count: 1, resetTime: 900 });
        map.set('live-b', { count: 1, resetTime: 901 });

        pruneAndCapRateLimitMap(map, 100, 2);

        expect([...map.keys()].sort()).toEqual(['live-a', 'live-b']);
    });

    it('caps at 5000 keys by default and drops the single oldest record above it', () => {
        for (let i = 0; i <= DEFAULT_MAX_KEYS; i++) {
            map.set(`k${String(i)}`, { count: 1, resetTime: 1_000_000 + i });
        }
        expect(map.size).toBe(DEFAULT_MAX_KEYS + 1);

        pruneAndCapRateLimitMap(map, 0);

        expect(map.size).toBe(DEFAULT_MAX_KEYS);
        expect(map.has('k0')).toBe(false);
        expect(map.has('k1')).toBe(true);
        expect(map.has(`k${String(DEFAULT_MAX_KEYS)}`)).toBe(true);
    });
});

describe('checkRateLimit', () => {
    let map: Map<string, RateLimitRecord>;

    beforeEach(() => {
        map = new Map();
    });

    it('opens a window on the first request: count 1, closing windowMs after now', () => {
        expect(checkRateLimit(map, 'ip', 5_000, WINDOW_MS, 3)).toBe(true);

        expect(map.get('ip')).toEqual({ count: 1, resetTime: 5_000 + WINDOW_MS });
    });

    it('counts each allowed request and refuses the one after maxRequests', () => {
        expect(checkRateLimit(map, 'ip', 5_000, WINDOW_MS, 3)).toBe(true);
        expect(checkRateLimit(map, 'ip', 5_001, WINDOW_MS, 3)).toBe(true);
        expect(map.get('ip')?.count).toBe(2);
        expect(checkRateLimit(map, 'ip', 5_002, WINDOW_MS, 3)).toBe(true);
        expect(map.get('ip')?.count).toBe(3);

        expect(checkRateLimit(map, 'ip', 5_003, WINDOW_MS, 3)).toBe(false);
        expect(checkRateLimit(map, 'ip', 5_004, WINDOW_MS, 3)).toBe(false);
    });

    it('refuses the second request when maxRequests is 1', () => {
        expect(checkRateLimit(map, 'ip', 0, WINDOW_MS, 1)).toBe(true);
        expect(checkRateLimit(map, 'ip', 1, WINDOW_MS, 1)).toBe(false);
    });

    it('does not count or extend the window on a refused request', () => {
        checkRateLimit(map, 'ip', 1_000, WINDOW_MS, 1);

        expect(checkRateLimit(map, 'ip', 30_000, WINDOW_MS, 1)).toBe(false);

        expect(map.get('ip')).toEqual({ count: 1, resetTime: 1_000 + WINDOW_MS });
    });

    it('still belongs to the same window at resetTime and opens a fresh one just after it', () => {
        const t0 = 10_000;
        expect(checkRateLimit(map, 'ip', t0, 1_000, 1)).toBe(true);

        expect(checkRateLimit(map, 'ip', t0 + 1_000, 1_000, 1)).toBe(false);

        expect(checkRateLimit(map, 'ip', t0 + 1_001, 1_000, 1)).toBe(true);
        expect(map.get('ip')).toEqual({ count: 1, resetTime: t0 + 1_001 + 1_000 });
    });

    it('tracks keys independently', () => {
        expect(checkRateLimit(map, 'a', 0, WINDOW_MS, 1)).toBe(true);
        expect(checkRateLimit(map, 'a', 1, WINDOW_MS, 1)).toBe(false);

        expect(checkRateLimit(map, 'b', 2, WINDOW_MS, 1)).toBe(true);
        expect(map.get('b')).toEqual({ count: 1, resetTime: 2 + WINDOW_MS });
    });

    it('prunes expired records of other keys on every call', () => {
        map.set('stale', { count: 9, resetTime: 100 });

        checkRateLimit(map, 'fresh', 200, WINDOW_MS, 5);

        expect(map.has('stale')).toBe(false);
        expect(map.has('fresh')).toBe(true);
    });

    it('bounds the map: a full map at the default cap sheds its oldest key on the next call', () => {
        // Every seeded window closes before the windows opened below, so "oldest" is unambiguous.
        for (let i = 0; i < DEFAULT_MAX_KEYS; i++) {
            map.set(`k${String(i)}`, { count: 1, resetTime: 1 + i });
        }

        checkRateLimit(map, 'newcomer-1', 0, WINDOW_MS, 5);
        expect(map.size).toBe(DEFAULT_MAX_KEYS + 1);

        checkRateLimit(map, 'newcomer-2', 0, WINDOW_MS, 5);

        expect(map.size).toBe(DEFAULT_MAX_KEYS + 1);
        expect(map.has('k0')).toBe(false);
        expect(map.has('k1')).toBe(true);
        expect(map.has('newcomer-1')).toBe(true);
        expect(map.has('newcomer-2')).toBe(true);
    });
});
