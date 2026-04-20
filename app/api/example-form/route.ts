import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/shared/lib/logger';
import { requireSameOrigin } from '@/shared/lib/requireSameOrigin';

/**
 * JSON POST/GET sample for non-browser or integration clients.
 * Browser form flows use the Server Action in app/actions/example-form.ts instead.
 */
// Edge runtime for faster cold start (optional - can be removed if you need Node.js APIs)
// export const runtime = 'edge';

export async function GET() {
    try {
        const data = {
            message: 'Hello from API route',
            timestamp: new Date().toISOString()
        };

        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        });
    } catch (err) {
        logger.error(
            '[example-form-api] GET failed',
            err instanceof Error ? err : new Error(String(err))
        );
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const originDenied = requireSameOrigin(request);
    if (originDenied) {
        return originDenied;
    }
    try {
        const body = await request.json();

        // Validate request body
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        // Process data
        const result = {
            received: body,
            processed: true,
            timestamp: new Date().toISOString()
        };

        return NextResponse.json(result, {
            status: 201,
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
        });
    } catch (err) {
        logger.error(
            '[example-form-api] POST failed',
            err instanceof Error ? err : new Error(String(err))
        );
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
