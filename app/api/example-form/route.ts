import { NextResponse } from 'next/server';

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
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
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
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
