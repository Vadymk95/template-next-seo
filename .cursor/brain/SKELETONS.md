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

## Template scaffolding (do not strip as "unused")

This repo is a template, not a shipped product. Several files, deps, and config entries are **intentionally present as patterns**, not because the current template has consumers for them. An agent running an "unused code" audit must treat the items below as load-bearing until the forked MVP actually replaces or removes them.

- **`lucide-react`** — default icon set; pre-wired in `next.config.ts` (`experimental.optimizePackageImports` + webpack `uiVendor` `splitChunks` regex) and exercised in `features/example-form/ui/ExampleForm.tsx` (pending/idle submit icons). Removing it breaks the "how to add icons" example and forces the next MVP to re-pick and re-wire an icon lib.
- **`shared/constants/index.ts`** — FSD pattern showcase (`ROUTES`, `API_BASE_URL`). Kept so MVPs have a ready place for cross-feature literals. Do not delete as "no consumers".
- **`features/example-form/**`** — canonical FSD feature skeleton: `model/schema.ts` (Zod), `model/types.ts` (`z.infer`), `ui/ExampleForm.tsx` (RHF + shadcn + i18n + icons), `/example-form` route. The full triad stays until the MVP ships real features.
- **Web Vitals pipeline** — `app/WebVitalsReporter.tsx` + `app/api/vitals/route.ts` kept minimal on purpose (log-only sink). Expand to analytics when the MVP picks a vendor; do not collapse further.

**Rule:** when in doubt, search for `Template scaffolding` inline comments — every protected site is marked. Only strip after the caller confirms "this is now my MVP, not the template".
