import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/shared/lib/logger';
import { requireSameOrigin } from '@/shared/lib/requireSameOrigin';

const MAX_BYTES = 8192;

const WHITELIST = [
    'blocked-uri',
    'violated-directive',
    'document-uri',
    'effective-directive'
] as const;

function extractCspReportBody(parsed: unknown): Record<string, unknown> | null {
    if (parsed === null || parsed === undefined) {
        return null;
    }
    if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
            return null;
        }
        const first = parsed[0];
        if (typeof first !== 'object' || first === null) {
            return null;
        }
        const row = first as Record<string, unknown>;
        if (typeof row.body === 'object' && row.body !== null) {
            return row.body as Record<string, unknown>;
        }
        return row;
    }
    if (typeof parsed === 'object') {
        const o = parsed as Record<string, unknown>;
        if (typeof o['csp-report'] === 'object' && o['csp-report'] !== null) {
            return o['csp-report'] as Record<string, unknown>;
        }
        return o;
    }
    return null;
}

function whitelistedSubset(payload: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of WHITELIST) {
        const val = payload[key];
        if (typeof val === 'string' && val.length > 0) {
            out[key] = val.length > 512 ? val.slice(0, 512) : val;
        }
    }
    return out;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const originDenied = requireSameOrigin(request);
    if (originDenied) {
        return originDenied;
    }

    const len = request.headers.get('content-length');
    if (len !== null) {
        const parsedLen = Number.parseInt(len, 10);
        if (!Number.isNaN(parsedLen) && parsedLen > MAX_BYTES) {
            return new NextResponse(null, { status: 413 });
        }
    }

    let text: string;
    try {
        text = await request.text();
    } catch {
        return new NextResponse(null, { status: 400 });
    }

    if (text.length > MAX_BYTES) {
        return new NextResponse(null, { status: 413 });
    }

    const bounded = text.slice(0, MAX_BYTES);
    let parsed: unknown;
    try {
        parsed = JSON.parse(bounded || '{}') as unknown;
    } catch {
        return new NextResponse(null, { status: 400 });
    }

    const reportBody = extractCspReportBody(parsed) ?? {};
    const safe = whitelistedSubset(reportBody);
    if (Object.keys(safe).length > 0) {
        logger.warn('[csp-report]', safe);
    }
    return new NextResponse(null, { status: 204 });
}
