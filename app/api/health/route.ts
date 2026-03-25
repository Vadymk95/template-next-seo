import { NextResponse } from 'next/server';

// Edge runtime for faster cold start
export const runtime = 'edge';

export async function GET() {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
    };

    return NextResponse.json(health, {
        status: 200,
        headers: {
            'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
        }
    });
}
