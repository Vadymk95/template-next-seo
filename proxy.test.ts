import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/middleware', () => ({
    default: () => () => undefined
}));

vi.mock('@/shared/lib/upstashRateLimit', () => ({
    getUpstashRatelimit: vi.fn(() => null)
}));

vi.mock('@/shared/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { getUpstashRatelimit } from '@/shared/lib/upstashRateLimit';

import { proxy } from './proxy';

describe('proxy', () => {
    beforeEach(() => {
        vi.mocked(getUpstashRatelimit).mockReset();
        vi.mocked(getUpstashRatelimit).mockReturnValue(null);
        vi.stubEnv('RATE_LIMIT_TRUST_PROXY', 'none');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('short-circuits asset-like API paths without applying proxy CSP', async () => {
        const res = await proxy(
            new NextRequest('http://localhost:3000/api/chunk.js', {
                headers: { 'user-agent': 'proxy-test-assets' }
            })
        );
        expect(res.headers.get('content-security-policy')).toBeNull();
    });

    it('returns 404 for /dev in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await proxy(
            new NextRequest('http://localhost:3000/dev/ui', {
                headers: { 'user-agent': 'proxy-test-dev-block' }
            })
        );
        expect(res.status).toBe(404);
    });

    it('applies nonce-based CSP on API responses in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await proxy(
            new NextRequest('http://localhost:3000/api/health', {
                headers: { 'user-agent': 'proxy-test-csp' }
            })
        );
        const csp = res.headers.get('content-security-policy');
        expect(csp).toBeTruthy();
        expect(csp).toContain("'strict-dynamic'");
        expect(csp).toContain("'nonce-");
    });

    it('returns 429 after exceeding the in-memory window', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const ua = 'proxy-test-rl-window-unique';
        const mk = () =>
            new NextRequest('http://localhost:3000/api/health', {
                headers: { 'user-agent': ua }
            });
        for (let i = 0; i < 100; i++) {
            const res = await proxy(mk());
            expect(res.status).not.toBe(429);
        }
        const blocked = await proxy(mk());
        expect(blocked.status).toBe(429);
    });

    it('uses Upstash when configured', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const limit = vi.fn().mockResolvedValue({ success: true });
        vi.mocked(getUpstashRatelimit).mockReturnValue({ limit } as never);
        await proxy(
            new NextRequest('http://localhost:3000/api/health', {
                headers: { 'user-agent': 'proxy-test-upstash' }
            })
        );
        expect(limit).toHaveBeenCalledTimes(1);
    });
});
