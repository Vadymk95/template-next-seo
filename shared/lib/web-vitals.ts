'use client';

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

type WebVitalsCallback = (metric: Metric) => void;

export function reportWebVitals(onPerfEntry?: WebVitalsCallback): void {
    if (onPerfEntry && typeof onPerfEntry === 'function') {
        onCLS(onPerfEntry);
        onINP(onPerfEntry); // INP replaced FID in web-vitals v3+
        onFCP(onPerfEntry);
        onLCP(onPerfEntry);
        onTTFB(onPerfEntry);
    }
}

// Simple console reporter (can be extended to send to analytics)
export function reportWebVitalsToConsole(metric: Metric): void {
    if (process.env.NODE_ENV === 'development') {
        const emoji =
            {
                good: '✅',
                'needs-improvement': '⚠️',
                poor: '❌'
            }[metric.rating] || '📊';

        console.log(`${emoji} [Web Vitals] ${metric.name}: ${metric.value}ms (${metric.rating})`, {
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta
        });
    }

    // In production, you can send to analytics API
    // Example:
    // if (process.env.NODE_ENV === 'production') {
    //   fetch('/api/analytics', {
    //     method: 'POST',
    //     body: JSON.stringify(metric),
    //   });
    // }
}
