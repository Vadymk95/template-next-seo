import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** The origin `NEXT_PUBLIC_APP_URL` configures, if it configures a usable one. */
function configuredOrigin(): string | undefined {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) {
        return undefined;
    }

    try {
        return new URL(raw.endsWith('/') ? raw.slice(0, -1) : raw).origin;
    } catch {
        return undefined;
    }
}

/**
 * The origin the request was actually SERVED on, derived from `Host`.
 *
 * Why `Host` and deliberately NOT `X-Forwarded-Host`: fetch forbids a browser from setting `Host`,
 * while `X-Forwarded-Host` is client-settable — so trusting the forwarded header would let
 * `Origin: https://evil.example` plus a matching forwarded host through. There is a test asserting
 * that exact request still gets 403.
 *
 * `request.nextUrl.origin` is not a substitute: it does not follow `Host`, so a genuinely same-origin
 * request on a LAN address or an alternate loopback was rejected whenever `NEXT_PUBLIC_APP_URL`
 * differed from the serving host — which it does in dev, in CI (`*.invalid`) and behind any
 * preview URL.
 *
 * Trade-off, accepted and stated: this trusts the request's `Host` as one accepted origin. Safe where
 * the platform sets it (Vercel, Cloud Run and friends), weaker behind a proxy that lets `Host` be
 * spoofed — the same caveat Next's own Server Action origin check carries. A route for which
 * host-trust is unacceptable must pin itself to the configured origin instead of calling this.
 */
function servingOrigin(request: NextRequest): string | undefined {
    const host = request.headers.get('host')?.trim();
    if (!host) {
        return undefined;
    }

    try {
        return new URL(`${request.nextUrl.protocol}//${host}`).origin;
    } catch {
        return undefined;
    }
}

/**
 * Blocks cross-site POST/PUT/PATCH/DELETE when `Origin` is missing, or matches neither the configured
 * app origin nor the origin the request was served on.
 */
export function requireSameOrigin(request: NextRequest): NextResponse | null {
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return null;
    }

    const origin = request.headers.get('origin');
    if (!origin) {
        return new NextResponse(null, { status: 403 });
    }

    const accepted = [configuredOrigin(), servingOrigin(request)];
    if (!accepted.includes(origin)) {
        return new NextResponse(null, { status: 403 });
    }

    return null;
}
