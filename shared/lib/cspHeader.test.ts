import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy, buildStaticContentSecurityPolicy } from './cspHeader';

describe('buildContentSecurityPolicy', () => {
    it('uses relaxed script-src in development', () => {
        const csp = buildContentSecurityPolicy('ignored', true);
        expect(csp).toContain("'unsafe-eval'");
        expect(csp).not.toContain('strict-dynamic');
        expect(csp).not.toContain('upgrade-insecure-requests');
        expect(csp).toContain('report-to csp-endpoint');
    });

    it('uses nonce and strict-dynamic in production', () => {
        const csp = buildContentSecurityPolicy('testNonce', false);
        expect(csp).toContain("'strict-dynamic'");
        expect(csp).toContain("'nonce-testNonce'");
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).toContain('upgrade-insecure-requests');
        expect(csp).toContain('report-to csp-endpoint');
    });
});

describe('buildStaticContentSecurityPolicy', () => {
    it('uses relaxed script-src in development', () => {
        const csp = buildStaticContentSecurityPolicy(true);
        expect(csp).toContain("'unsafe-eval'");
        expect(csp).not.toContain('strict-dynamic');
    });

    it('uses host-only script-src in production', () => {
        const csp = buildStaticContentSecurityPolicy(false);
        expect(csp).toMatch(/script-src 'self'/);
        expect(csp).not.toContain('strict-dynamic');
        expect(csp).not.toContain('nonce-');
        expect(csp).toContain('upgrade-insecure-requests');
    });
});
