// The decision half of the build-env pre-flight. The point of these cases is the
// localhost one: `shared/lib/env.ts` rejects localhost in production, so a guard
// that only checked presence would pass a value the build then refuses — which is
// exactly the confusing failure this script exists to remove.
import { describe, expect, it } from 'vitest';

import { evaluateBuildEnv } from './check-build-env.mjs';

describe('evaluateBuildEnv', () => {
    it('accepts a public https origin', () => {
        expect(evaluateBuildEnv('https://example.com')).toEqual({ ok: true, reason: null });
    });

    it('accepts the reserved .invalid placeholder CI uses', () => {
        expect(evaluateBuildEnv('https://template-next-seo.invalid')).toMatchObject({ ok: true });
    });

    it('rejects an unset variable', () => {
        expect(evaluateBuildEnv(undefined)).toEqual({ ok: false, reason: 'missing' });
    });

    it('rejects whitespace, which an empty .env line produces', () => {
        expect(evaluateBuildEnv('   ')).toEqual({ ok: false, reason: 'missing' });
    });

    it('rejects a bare host with no scheme', () => {
        expect(evaluateBuildEnv('example.com')).toEqual({ ok: false, reason: 'not-a-url' });
    });

    it('rejects localhost — the value .env.example used to suggest', () => {
        expect(evaluateBuildEnv('http://localhost:3000')).toEqual({
            ok: false,
            reason: 'localhost'
        });
    });

    it('rejects 127.0.0.1 as well as the localhost name', () => {
        expect(evaluateBuildEnv('http://127.0.0.1:3000')).toEqual({
            ok: false,
            reason: 'localhost'
        });
    });

    it('does not reject a hostname that merely contains the word localhost', () => {
        // A substring check on the whole URL would fail this. The real deployment
        // `https://localhost-tools.example.com` is a public origin.
        expect(evaluateBuildEnv('https://localhost-tools.example.com')).toMatchObject({
            ok: true
        });
    });
});
