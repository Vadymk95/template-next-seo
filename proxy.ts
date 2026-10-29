import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';
import { buildContentSecurityPolicy, CSP_NONCE_HEADER } from '@/shared/lib/cspHeader';
import { logger } from '@/shared/lib/logger';
import { getRateLimitKey, isAssetPath } from '@/shared/lib/middlewareRequest';
import { checkRateLimit } from '@/shared/lib/rateLimitCore';
import { getUpstashRatelimit } from '@/shared/lib/upstashRateLimit';

const intlMiddleware = createIntlMiddleware(routing);

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;

// 16 bytes = 128 bits of entropy, the floor the CSP spec's nonce guidance assumes.
const NONCE_BYTES = 16;

// A rate-limit key can hold a client IP, and a log line must never carry one. The log hint is the
// key's kind (`ip:` or `anon:`) plus the first bytes of a SHA-256 digest of the key. The digest is
// salted with a random value that stays in memory: a bare hash of an IPv4 address can be reversed
// by hashing all 2^32 addresses, a salted one cannot without the process. Two entries from one
// process still carry the same hint for the same client.
const KEY_HINT_DIGEST_BYTES = 4;
const HEX_RADIX = 16;
let keyHintSalt: string | undefined;

function generateNonce(): string {
    const bytes = new Uint8Array(NONCE_BYTES);
    crypto.getRandomValues(bytes);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
}

function applyProxyCsp(response: NextResponse, requestNonce: string, isDev: boolean): void {
    response.headers.set(
        'Content-Security-Policy',
        buildContentSecurityPolicy(requestNonce, isDev)
    );
}

async function describeRateLimitKey(key: string): Promise<string> {
    // Everything up to and including the first ':'. A key without one yields an empty kind, so no
    // part of its value can reach the log.
    const kind = key.slice(0, key.indexOf(':') + 1);
    keyHintSalt ??= crypto.randomUUID();
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`${keyHintSalt}${key}`)
    );
    const hex = Array.from(new Uint8Array(digest, 0, KEY_HINT_DIGEST_BYTES), (byte) =>
        byte.toString(HEX_RADIX).padStart(2, '0')
    ).join('');
    return `${kind}${hex}`;
}

// @upstash/redis appends the failed command to its error text, and that command holds the
// rate-limit key. The key is cut out of a copy, so the cause stays readable and the log carries no
// client address.
function withoutKey(error: Error, key: string): Error {
    const clean = new Error(error.message.replaceAll(key, '[key]'));
    clean.name = error.name;
    if (error.stack !== undefined) {
        clean.stack = error.stack.replaceAll(key, '[key]');
    }
    return clean;
}

// Next runs a POST as a Server Action when it carries `next-action`, and also when it is a form
// post: the content type is exactly application/x-www-form-urlencoded or starts with
// multipart/form-data. A form posted without script sends no `next-action` header, so the header
// alone would leave it unthrottled. This is Next's own rule (getServerActionRequestMetadata in
// next/dist/server/lib/server-action-request-meta.js); proxy.test.ts compares the two.
function isServerActionRequest(request: NextRequest): boolean {
    if (request.method !== 'POST') {
        return false;
    }
    const contentType = request.headers.get('content-type');
    return (
        request.headers.has('next-action') ||
        contentType === 'application/x-www-form-urlencoded' ||
        (contentType?.startsWith('multipart/form-data') ?? false)
    );
}

async function enforceApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const isApi = request.nextUrl.pathname.startsWith('/api/');
    const isServerAction = isServerActionRequest(request);
    if (!isApi && !isServerAction) {
        return null;
    }

    const key = getRateLimitKey(request);
    const upstash = getUpstashRatelimit();

    if (upstash) {
        try {
            const { success } = await upstash.limit(key);
            if (!success) {
                return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
            }
            return null;
        } catch (err) {
            logger.error(
                '[proxy] Upstash rate limit failed; falling back to in-memory limiter',
                withoutKey(err instanceof Error ? err : new Error(String(err)), key),
                { keyHint: await describeRateLimitKey(key) }
            );
        }
    }

    const now = Date.now();
    if (!checkRateLimit(rateLimitMap, key, now, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    return null;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;

    if (isAssetPath(pathname)) {
        return NextResponse.next();
    }

    const rateResponse = await enforceApiRateLimit(request);
    if (rateResponse) {
        return rateResponse;
    }

    const isDevPath = pathname.startsWith('/dev');
    if (process.env.NODE_ENV === 'production' && isDevPath) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isApi = pathname.startsWith('/api/');
    const isDev = process.env.NODE_ENV !== 'production';

    if (isApi || isDevPath) {
        // API + /dev are dynamic: per-request nonce CSP works because Next renders
        // each request fresh and (when forwarded via x-nonce on request headers)
        // automatically attaches `nonce="..."` to its emitted inline scripts.
        const nonce = generateNonce();
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(CSP_NONCE_HEADER, nonce);
        const response = NextResponse.next({ request: { headers: requestHeaders } });
        applyProxyCsp(response, nonce, isDev);
        return response;
    }

    // Document routes are ISR'd (`/[locale]` 1h, `/[locale]/example-form` 30m).
    // ISR HTML is prerendered at BUILD TIME and cached — middleware sets CSP
    // headers per-request, but the HTML body is static. A per-request nonce
    // would arrive in the header without ever appearing on the inline scripts
    // in the cached HTML, so CSP would block hydration in any CSP-respecting
    // browser. Per Next.js docs (CSP guide, "Nonces"): "Nonces only support
    // dynamic routes." For ISR / static routes the recommendation is hash-based
    // CSP — impractical here because the inline `__next_f.push` payload differs
    // per page. The static CSP in `next.config.ts` headers() therefore allows
    // `'unsafe-inline'` for `script-src` — required by Next 16 RSC inline
    // bootstrap scripts on ISR routes. Trade-off documented in
    // .cursor/brain/DECISIONS.md ("Content Security Policy: nonce on dynamic routes").
    return intlMiddleware(request);
}

export const config = {
    matcher: ['/api/:path*', '/dev/:path*', '/((?!_next|_vercel|api|dev|.*\\..*).*)']
};
