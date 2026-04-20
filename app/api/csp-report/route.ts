import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/shared/lib/logger';
import { requireSameOrigin } from '@/shared/lib/requireSameOrigin';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const originDenied = requireSameOrigin(request);
    if (originDenied) {
        return originDenied;
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        body = { parseError: true };
    }
    logger.warn('[csp-report]', {
        report:
            typeof body === 'object' && body !== null
                ? (body as Record<string, unknown>)
                : { value: body }
    });
    return new NextResponse(null, { status: 204 });
}
