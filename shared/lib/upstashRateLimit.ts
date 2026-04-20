import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const WINDOW = '60 s';
const MAX_REQUESTS = 100;
const PREFIX = 'template-next-seo:ratelimit';

let cached: Ratelimit | null | undefined;

/**
 * Distributed rate limit for Edge middleware when Upstash env is set.
 * If URL/token are missing, returns null and callers should use in-memory fallback.
 */
export function getUpstashRatelimit(): Ratelimit | null {
    if (cached !== undefined) {
        return cached;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        cached = null;
        return null;
    }

    const redis = new Redis({ url, token });
    cached = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS, WINDOW),
        prefix: PREFIX,
        analytics: false
    });
    return cached;
}
