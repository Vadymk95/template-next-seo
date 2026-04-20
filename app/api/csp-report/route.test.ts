import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/shared/lib/logger';

import { POST } from './route';

vi.mock('@/shared/lib/logger', () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('POST /api/csp-report', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns 413 when Content-Length exceeds the cap', async () => {
        const req = new NextRequest('http://localhost:3000/api/csp-report', {
            method: 'POST',
            headers: {
                origin: 'http://localhost:3000',
                'content-type': 'application/csp-report',
                'content-length': '9000'
            },
            body: '{}'
        });
        const res = await POST(req);
        expect(res.status).toBe(413);
        expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed JSON', async () => {
        const req = new NextRequest('http://localhost:3000/api/csp-report', {
            method: 'POST',
            headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
            body: '{not json'
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    });

    it('returns 204 and logs only whitelisted CSP fields', async () => {
        const body = JSON.stringify({
            'csp-report': {
                'blocked-uri': 'inline',
                'violated-directive': 'script-src-elem',
                'document-uri': 'https://example.com/',
                'effective-directive': 'script-src',
                'original-policy': 'should-not-appear'
            }
        });
        const req = new NextRequest('http://localhost:3000/api/csp-report', {
            method: 'POST',
            headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
            body
        });
        const res = await POST(req);
        expect(res.status).toBe(204);
        expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
        const arg = vi.mocked(logger.warn).mock.calls[0];
        expect(arg?.[0]).toBe('[csp-report]');
        expect(arg?.[1]).toEqual({
            'blocked-uri': 'inline',
            'violated-directive': 'script-src-elem',
            'document-uri': 'https://example.com/',
            'effective-directive': 'script-src'
        });
    });
});
