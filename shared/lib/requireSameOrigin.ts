import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function expectedOrigin(request: NextRequest): string {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (raw) {
        return new URL(raw.endsWith('/') ? raw.slice(0, -1) : raw).origin;
    }
    return request.nextUrl.origin;
}

/**
 * Blocks cross-site POST/PUT/PATCH/DELETE when Origin is missing or does not match the app origin.
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

    const expected = expectedOrigin(request);
    if (origin !== expected) {
        return new NextResponse(null, { status: 403 });
    }

    return null;
}
