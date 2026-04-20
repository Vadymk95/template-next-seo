# SKELETONS — danger zones (template-next-seo)

## Custom `webpack()` in `next.config.ts`

- **Risk:** `next build` without **`--webpack`** uses Turbopack; custom webpack config is ignored or can error.
- **Rule:** Use **`npm run build`** (webpack). Do not assume Turbopack parity for chunk names or analyzer.

## Server vs Client Components

- **Risk:** importing client-only modules (`useEffect`, browser APIs, client store hooks) into Server Components breaks the build or causes subtle errors.
- **Mitigation:** Add **`'use client'`** only at boundaries that need it; keep data-fetching defaults on the server where possible.

## i18n (client-only)

- **Risk:** browser detectors, cached language, and bundled defaults can desync from new locale keys (wrong language, flash of untranslated content).
- **Mitigation:** When changing locale keys or detection order, test first load, hard refresh, and `html.i18n-*` classes in `globals.css`.

## SEO surfaces

- **Risk:** `sitemap.ts` / `robots.ts` / metadata must stay consistent with real deploy URL and `NEXT_PUBLIC_*` base URL assumptions.
- **Mitigation:** Document env vars in README when changing canonical URLs or multi-domain setups.

## Path alias `@/*`

- **Risk:** deep relative imports bypass FSD mental model and break refactors.
- **Mitigation:** Prefer **`@/features/...`**, **`@/entities/...`**, **`@/shared/...`**, **`@/app/...`** consistently.

## Parent monorepo lockfiles

- **Risk:** wrong tracing root / duplicated deps in analysis.
- **Mitigation:** `outputFileTracingRoot` + `turbopack.root` in `next.config.ts`; avoid adding competing lockfiles at repo root without updating config.

## In-memory API rate limit

- **Risk:** per-isolate map does not coordinate across regions/instances; under attack, capped map evicts oldest windows (possible fairness quirks). **`proxy.ts`** matcher limits where the Edge limiter runs—easy to assume coverage on routes that never hit it.
- **Mitigation:** set **Upstash** env vars for distributed limits; align **`config.matcher`** with every surface that must be throttled; tune **`rateLimitCore`** / Node **`rateLimit`** for non-proxy handlers if added.

## COOP / CORP / strict CSP

- **Risk:** **`Cross-Origin-Opener-Policy: same-origin`** and **`Cross-Origin-Resource-Policy: same-origin`** can break legacy **OAuth popup** flows or rare third-party embeds.
- **Mitigation:** relax headers only for routes that need popups, or move auth to **same-tab redirects**.

## Narrow `proxy` matcher

- **Risk:** nonce CSP, `/dev` gate, and rate checks apply only to paths in **`config.matcher`**; document HTML keeps static CSP from **`next.config`**—widening matcher changes security and runtime cost.
- **Mitigation:** treat matcher edits as a security review; keep **`next.config`** and **`proxy.ts`** CSP stories in sync when adding routes.
