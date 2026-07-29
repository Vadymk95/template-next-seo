#!/usr/bin/env node
/**
 * Pre-flight for the production build. `shared/lib/env.ts` requires
 * NEXT_PUBLIC_APP_URL when NODE_ENV=production and rejects localhost values,
 * because a localhost origin would bake into prerendered metadata, sitemap and
 * hreflang and ship to crawlers. That check is correct — but it fires from inside
 * `next build`'s page-data collection, so a missing variable surfaces as a Zod
 * trace under "Failed to collect configuration for /_not-found" with no hint
 * about what to set.
 *
 * This runs before the build in `verify` and turns that into one actionable line.
 * It is called explicitly rather than as a `prebuild` lifecycle hook: `.npmrc`
 * sets ignore-scripts=true as a supply-chain guard, which also suppresses
 * pre/post script hooks — the same reason `check-hooks.mjs` is called explicitly.
 *
 * It loads `.env*` through `@next/env` — the same loader `next build` uses —
 * rather than reading `process.env` alone. Node does not read `.env.local`; only
 * Next does. A guard that skipped this would report "not set" while the build
 * would have succeeded from `.env.local`, which is a worse failure than the one
 * it replaces: a gate that blocks a valid state.
 */
// `@next/env` is CommonJS with no named ESM exports — a named import throws
// `SyntaxError: Named export 'loadEnvConfig' not found` at load time.
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export const evaluateBuildEnv = (value) => {
    if (value === undefined || value.trim() === '') {
        return { ok: false, reason: 'missing' };
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return { ok: false, reason: 'not-a-url' };
    }

    if (LOCAL_HOSTS.includes(parsed.hostname)) {
        return { ok: false, reason: 'localhost' };
    }

    return { ok: true, reason: null };
};

const MESSAGES = {
    missing: 'NEXT_PUBLIC_APP_URL is not set.',
    'not-a-url': 'NEXT_PUBLIC_APP_URL is not a valid absolute URL.',
    localhost:
        'NEXT_PUBLIC_APP_URL points at localhost, which the production build rejects on purpose — a localhost origin in prerendered metadata, sitemap and hreflang would reach crawlers.'
};

const main = () => {
    // `dev: false` so the precedence matches `next build`, and `log: false` so the
    // gate output stays quiet on the happy path.
    loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

    const result = evaluateBuildEnv(process.env.NEXT_PUBLIC_APP_URL);
    if (result.ok) {
        return;
    }

    console.error('');
    console.error(`✖ production build env: ${MESSAGES[result.reason]}`);
    console.error('');
    console.error('  The build runs with NODE_ENV=production, and it drives metadataBase,');
    console.error('  sitemap.xml, the robots.txt sitemap line and hreflang alternates.');
    console.error('');
    console.error('  Fix once, locally:   cp .env.example .env.local');
    console.error(
        '  Or for a single run: NEXT_PUBLIC_APP_URL=https://example.invalid npm run verify'
    );
    console.error('');
    console.error('  Dev needs nothing — `next dev` defaults to http://localhost:3000.');
    console.error('  CI sets it at the workflow level (.github/workflows/ci.yml).');
    console.error('');
    process.exit(1);
};

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
