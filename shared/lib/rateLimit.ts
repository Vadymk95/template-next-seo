import 'server-only';

/**
 * Server-only re-export. Edge middleware and Vitest import `./rateLimitCore` directly.
 */
export type { RateLimitRecord } from './rateLimitCore';
export { checkRateLimit, pruneAndCapRateLimitMap } from './rateLimitCore';
