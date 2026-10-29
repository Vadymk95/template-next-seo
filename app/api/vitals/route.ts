import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Metric } from 'web-vitals';
import { z } from 'zod';

import { logger } from '@/shared/lib/logger';
import { requireSameOrigin } from '@/shared/lib/requireSameOrigin';

// The beacon is a whole web-vitals Metric (app/WebVitalsReporter.tsx); its `entries`,
// `navigationURL` and id carry page URLs and element data, and a client can post anything. Only
// these fields reach the log, each checked against the sets `Metric` declares; every other key is
// dropped by the schema.
const VitalsMetricSchema = z.object({
    name: z.enum(['CLS', 'FCP', 'INP', 'LCP', 'TTFB'] as const satisfies readonly Metric['name'][]),
    value: z.number(),
    delta: z.number(),
    rating: z.enum([
        'good',
        'needs-improvement',
        'poor'
    ] as const satisfies readonly Metric['rating'][]),
    navigationType: z.enum([
        'navigate',
        'reload',
        'back-forward',
        'back-forward-cache',
        'prerender',
        'restore',
        'soft-navigation'
    ] as const satisfies readonly Metric['navigationType'][])
});

export async function POST(request: NextRequest): Promise<NextResponse> {
    const originDenied = requireSameOrigin(request);
    if (originDenied) {
        return originDenied;
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        // Not JSON: the schema rejects it like any other bad body.
        body = null;
    }
    const metric = VitalsMetricSchema.safeParse(body);
    logger.info('[vitals]', metric.success ? { metric: metric.data } : { invalid: true });
    return new NextResponse(null, { status: 204 });
}
