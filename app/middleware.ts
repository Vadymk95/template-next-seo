import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildContentSecurityPolicy, CSP_NONCE_HEADER } from '@/shared/lib/cspHeader';
import { checkRateLimit } from '@/shared/lib/rateLimit';
import { getUpstashRatelimit } from '@/shared/lib/upstashRateLimit';

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

function getRateLimitKey(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    return forwarded ? forwarded.split(',')[0]!.trim() : 'unknown';
}

function isAssetPath(pathname: string): boolean {
    return (
        pathname.startsWith('/_next/static') ||
        pathname.startsWith('/_next/image') ||
        /\.(css|js|woff|woff2|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|ico|avif)$/i.test(pathname)
    );
}

function applySecurityHeaders(response: NextResponse, requestNonce: string, isDev: boolean): void {
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    response.headers.set(
        'Content-Security-Policy',
        buildContentSecurityPolicy(requestNonce, isDev)
    );
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

    if (process.env.NODE_ENV === 'production') {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );
    }
}

async function enforceApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
    if (!request.nextUrl.pathname.startsWith('/api/')) {
        return null;
    }

    const key = getRateLimitKey(request);
    const upstash = getUpstashRatelimit();

    if (upstash) {
        const { success } = await upstash.limit(key);
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }
        return null;
    }

    const now = Date.now();
    if (!checkRateLimit(rateLimitMap, key, now, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    return null;
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    if (isAssetPath(pathname)) {
        return NextResponse.next();
    }

    const rateResponse = await enforceApiRateLimit(request);
    if (rateResponse) {
        return rateResponse;
    }

    if (process.env.NODE_ENV === 'production' && pathname.startsWith('/dev')) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const nonce = generateNonce();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CSP_NONCE_HEADER, nonce);

    const response = NextResponse.next({
        request: { headers: requestHeaders }
    });

    applySecurityHeaders(response, nonce, isDev);

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|otf|eot|ico|avif)$).*)'
    ]
};
