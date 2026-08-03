import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requireSameOrigin } from './requireSameOrigin';

describe('requireSameOrigin', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('allows GET without Origin', () => {
        const req = new NextRequest('http://localhost:3000/api/example-form', { method: 'GET' });
        expect(requireSameOrigin(req)).toBeNull();
    });

    it('allows POST when Origin matches NEXT_PUBLIC_APP_URL', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
        const req = new NextRequest('http://localhost:3000/api/example-form', {
            method: 'POST',
            headers: { origin: 'http://localhost:3000' }
        });
        expect(requireSameOrigin(req)).toBeNull();
    });

    it('blocks POST when Origin is cross-site', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
        const req = new NextRequest('http://localhost:3000/api/example-form', {
            method: 'POST',
            headers: { origin: 'https://evil.com' }
        });
        const res = requireSameOrigin(req);
        expect(res?.status).toBe(403);
    });

    it('allows POST from the SERVING origin even when APP_URL points elsewhere', () => {
        // The case the previous version rejected: dev, CI (`*.invalid`) and any preview URL all serve
        // on a host that is not the configured origin, so a genuinely same-origin request was refused.
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://template-next-seo.invalid');
        const req = new NextRequest('http://192.168.1.20:3000/api/example-form', {
            method: 'POST',
            headers: { origin: 'http://192.168.1.20:3000', host: '192.168.1.20:3000' }
        });
        expect(requireSameOrigin(req)).toBeNull();
    });

    it('still allows the configured origin when the request is served elsewhere', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
        const req = new NextRequest('https://app.example.com/api/example-form', {
            method: 'POST',
            headers: { origin: 'https://app.example.com', host: 'internal-lb.local' }
        });
        expect(requireSameOrigin(req)).toBeNull();
    });

    it('blocks a foreign Origin even when x-forwarded-host repeats it', () => {
        // `X-Forwarded-Host` is client-settable, so accepting it would hand an attacker the check.
        // `Host` is not settable from fetch, which is why only `Host` is consulted.
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
        const req = new NextRequest('https://app.example.com/api/example-form', {
            method: 'POST',
            headers: {
                origin: 'https://evil.example',
                host: 'app.example.com',
                'x-forwarded-host': 'evil.example'
            }
        });
        expect(requireSameOrigin(req)?.status).toBe(403);
    });

    it('blocks when neither the configured nor the serving origin matches', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
        const req = new NextRequest('https://app.example.com/api/example-form', {
            method: 'POST',
            headers: { origin: 'https://evil.example', host: 'app.example.com' }
        });
        expect(requireSameOrigin(req)?.status).toBe(403);
    });

    it('blocks POST when Origin header is absent', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
        const req = new NextRequest('http://localhost:3000/api/example-form', {
            method: 'POST'
        });
        expect(requireSameOrigin(req)?.status).toBe(403);
    });
});
