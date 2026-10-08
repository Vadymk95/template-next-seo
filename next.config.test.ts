import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildStaticContentSecurityPolicy } from '@/shared/lib/cspHeader';

import nextConfig from './next.config';

const loadRules = async (nodeEnv: 'production' | 'development') => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    const { headers } = nextConfig;
    if (!headers) {
        throw new Error('next.config.ts defines no headers()');
    }
    return headers();
};

const loadHeaders = async (nodeEnv: 'production' | 'development') => {
    const rules = await loadRules(nodeEnv);
    return Object.fromEntries(rules.flatMap((rule) => rule.headers.map((h) => [h.key, h.value])));
};

const EXPECTED_HEADERS: [string, string][] = [
    ['X-DNS-Prefetch-Control', 'on'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    ['Reporting-Endpoints', 'csp-endpoint="/api/csp-report"'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-origin']
];

describe('next.config agentRules', () => {
    it('keeps `next dev` from writing its managed block into AGENTS.md', () => {
        expect(nextConfig.agentRules).toBe(false);
    });
});

describe('next.config headers()', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('applies one rule that covers every path', async () => {
        const rules = await loadRules('production');

        expect(rules).toHaveLength(1);
        expect(rules[0]?.source).toBe('/:path*');
    });

    it.each(EXPECTED_HEADERS)(
        'sets %s to its documented value in production',
        async (key, value) => {
            const headers = await loadHeaders('production');

            expect(headers[key]).toBe(value);
        }
    );

    it.each(EXPECTED_HEADERS)(
        'sets %s to the same value outside production',
        async (key, value) => {
            const headers = await loadHeaders('development');

            expect(headers[key]).toBe(value);
        }
    );

    it('sets the static document CSP from the shared builder in production', async () => {
        const headers = await loadHeaders('production');

        expect(headers['Content-Security-Policy']).toBe(buildStaticContentSecurityPolicy(false));
    });

    it('sets the relaxed development CSP outside production', async () => {
        const headers = await loadHeaders('development');

        expect(headers['Content-Security-Policy']).toBe(buildStaticContentSecurityPolicy(true));
    });

    it('sets Strict-Transport-Security with preload in production', async () => {
        const headers = await loadHeaders('production');

        expect(headers['Strict-Transport-Security']).toBe(
            'max-age=31536000; includeSubDomains; preload'
        );
    });

    it('does not set Strict-Transport-Security outside production', async () => {
        const headers = await loadHeaders('development');

        expect(headers).not.toHaveProperty('Strict-Transport-Security');
    });
});
