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

    it('blocks POST when Origin header is absent', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
        const req = new NextRequest('http://localhost:3000/api/example-form', {
            method: 'POST'
        });
        expect(requireSameOrigin(req)?.status).toBe(403);
    });
});
