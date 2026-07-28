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

// A rate-limit key can contain a client IP. Only a prefix goes into a log line —
// enough to correlate two entries, not enough to be a stored identifier.
const KEY_HINT_LENGTH = 24;

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

async function enforceApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
    const isApi = request.nextUrl.pathname.startsWith('/api/');
    const isServerAction = Boolean(request.headers.get('next-action'));
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
                err instanceof Error ? err : new Error(String(err)),
                { keyHint: key.slice(0, KEY_HINT_LENGTH) }
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
    // .cursor/brain/DECISIONS.md ("CSP: nonce on dynamic, unsafe-inline on ISR").
    return intlMiddleware(request);
}

export const config = {
    matcher: ['/api/:path*', '/dev/:path*', '/((?!_next|_vercel|api|dev|.*\\..*).*)']
};
