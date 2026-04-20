import { NextResponse } from 'next/server';

import { logger } from '@/shared/lib/logger';

export async function POST(request: Request): Promise<NextResponse> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        body = { parseError: true };
    }
    logger.info('[vitals]', {
        metric:
            typeof body === 'object' && body !== null
                ? (body as Record<string, unknown>)
                : { value: body }
    });
    return new NextResponse(null, { status: 204 });
}
