/**
 * In-memory sliding-window rate limiting (Edge-safe, no server-only).
 * For middleware and tests. Server routes should prefer `@/shared/lib/rateLimit` for the server-only boundary.
 */

export type RateLimitRecord = {
    count: number;
    resetTime: number;
};

const DEFAULT_MAX_KEYS = 5_000;

export function pruneAndCapRateLimitMap(
    map: Map<string, RateLimitRecord>,
    now: number,
    maxKeys = DEFAULT_MAX_KEYS
): void {
    for (const [key, rec] of map) {
        if (now > rec.resetTime) {
            map.delete(key);
        }
    }
    if (map.size <= maxKeys) {
        return;
    }
    const entries = [...map.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
    const overflow = map.size - maxKeys;
    for (let i = 0; i < overflow; i++) {
        const pair = entries[i];
        if (pair) {
            map.delete(pair[0]);
        }
    }
}

export function checkRateLimit(
    map: Map<string, RateLimitRecord>,
    key: string,
    now: number,
    windowMs: number,
    maxRequests: number
): boolean {
    pruneAndCapRateLimitMap(map, now);
    const record = map.get(key);

    if (!record || now > record.resetTime) {
        map.set(key, {
            count: 1,
            resetTime: now + windowMs
        });
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count += 1;
    return true;
}
