import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Metric } from 'web-vitals';
import { z } from 'zod';

import { logger } from '@/shared/lib/logger';
import { requireSameOrigin } from '@/shared/lib/requireSameOrigin';

// The beacon is a whole web-vitals Metric (app/WebVitalsReporter.tsx); its `entries`,
// `navigationURL` and id carry page URLs and element data, and a client can post anything. Only
// these fields reach the log, each checked against the sets `Metric` declares; every other key is
// dropped by the schema. The page the metric belongs to is added separately, as a path (`pageOf`).
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

// A client chooses the path, so it is cut before it reaches a log line (the limit of the CSP report
// route).
const MAX_REPORTED_FIELD_LENGTH = 512;

// The path of the page a metric was measured on, or undefined. It is read from the raw body, not the
// schema: a missing or malformed `navigationURL` leaves the page out and never makes a valid metric
// invalid. Only http(s) URLs count, because the pathname of `mailto:` and `javascript:` is their
// payload, and neither the query, the hash, the credentials nor the origin is kept.
const pageOf = (body: unknown): string | undefined => {
    if (typeof body !== 'object' || body === null || !('navigationURL' in body)) {
        return undefined;
    }
    const { navigationURL } = body;
    if (typeof navigationURL !== 'string') {
        return undefined;
    }
    const url = URL.parse(navigationURL);
    if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        return undefined;
    }
    return url.pathname.slice(0, MAX_REPORTED_FIELD_LENGTH);
};

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
    if (metric.success) {
        // The key is left out, not set to undefined, when the page is unknown.
        const page = pageOf(body);
        logger.info('[vitals]', {
            metric: { ...metric.data, ...(page === undefined ? {} : { page }) }
        });
    } else {
        logger.info('[vitals]', { invalid: true });
    }
    return new NextResponse(null, { status: 204 });
}
