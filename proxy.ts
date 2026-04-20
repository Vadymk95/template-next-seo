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

function generateNonce(): string {
    const bytes = new Uint8Array(16);
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
                { keyHint: key.slice(0, 24) }
            );
        }
    }

    const now = Date.now();
    if (!checkRateLimit(rateLimitMap, key, now, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    return null;
}

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    if (isAssetPath(pathname)) {
        return NextResponse.next();
    }

    const rateResponse = await enforceApiRateLimit(request);
    if (rateResponse) {
        return rateResponse;
    }

    const isApi = pathname.startsWith('/api/');
    const isDevPath = pathname.startsWith('/dev');

    if (isApi || isDevPath) {
        if (process.env.NODE_ENV === 'production' && isDevPath) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const isDev = process.env.NODE_ENV !== 'production';
        const nonce = generateNonce();
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(CSP_NONCE_HEADER, nonce);

        const response = NextResponse.next({
            request: { headers: requestHeaders }
        });

        applyProxyCsp(response, nonce, isDev);

        return response;
    }

    return intlMiddleware(request);
}

export const config = {
    matcher: ['/api/:path*', '/dev/:path*', '/((?!_next|_vercel|api|dev|.*\\..*).*)']
};
