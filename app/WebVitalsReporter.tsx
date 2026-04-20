'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitalsReporter() {
    useReportWebVitals((metric) => {
        if (typeof fetch === 'undefined') {
            return;
        }
        const body = JSON.stringify(metric);
        void fetch('/api/vitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
            credentials: 'same-origin'
        });
    });
    return null;
}
