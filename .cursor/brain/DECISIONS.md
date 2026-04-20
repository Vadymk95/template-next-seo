# DECISIONS — template-next-seo

## Tailwind CSS v4

- Configuration lives in **`app/globals.css`** (`@import 'tailwindcss'`, `@theme inline`, design tokens). **`tailwind.config.ts` removed.** PostCSS uses **`@tailwindcss/postcss`** only (no `autoprefixer`; v4 handles intended targets).
- Animation: **`tw-animate-css`** replaces `tailwindcss-animate`.

## Production build: webpack by default

- **`next build`** defaults to Turbopack in Next 16; this repo defines a custom **`webpack()`** hook for vendor chunking and bundle analyzer.
- **Decision:** `package.json` **`build`** / **`build:analyze`** use **`next build --webpack`** so production builds remain deterministic with custom splits. **`build:turbo`** is optional for Turbopack-only experiments.

## Monorepo / multiple lockfiles

- When the repo sits under a parent folder with another lockfile, Next may pick the wrong workspace root.
- **Mitigation:** `next.config.ts` sets **`outputFileTracingRoot`** and **`turbopack.root`** to the package directory (`import.meta.url`).

## ESLint + Oxlint (strict, template-1 parity)

- **Oxlint:** CLI `oxlint` + `.oxlintrc.json` — fast first pass (react + typescript plugins, core JS rules). `npm run lint` runs **`lint:oxlint` then `eslint`**. Overrides for tests, e2e, scripts, logger/web-vitals (no-console off where intentional).
- **ESLint base:** `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, then **`eslint-plugin-oxlint` `flat/all`** (disables ESLint rules already covered by oxlint so custom severities win).
- **Imports:** **`eslint-plugin-import-x`** + `eslint-import-resolver-typescript` via `import-x/resolver-next` — `import-x/order`, `import-x/no-cycle`, recommended import-x rules.
- **React:** **`eslint-plugin-react`** — flat recommended + `jsx-runtime`, plus `react/no-array-index-key`, `no-unstable-nested-components`, `jsx-no-useless-fragment`, `self-closing-comp`; `react/prop-types` off (TypeScript).
- **Type-aware strictness:** `parserOptions.projectService` + `@typescript-eslint/no-floating-promises`, `no-misused-promises` with **`checksVoidReturn.attributes: false`** (React event/async handlers), `no-import-type-side-effects`, `switch-exhaustiveness-check`.
- **Imports / style:** `no-restricted-imports` — no `FC`; parent-relative `../` banned in favor of `@/`.
- **Prettier in ESLint:** **`eslint-plugin-prettier/recommended`** (last config block) so `prettier/prettier` runs as an ESLint rule.
- **Playwright / e2e:** `typescript-eslint` `disableTypeChecked` + `import-x/order` & `import-x/no-cycle` off.
- **Not enabled:** `func-style: expression` globally — Next idioms use `export async function` for routes, **`proxy`**, and Server Actions; enabling would fight the framework.

## ESLint & TypeScript majors (hold)

- **ESLint 9.x** — `eslint-plugin-react-hooks` (v5/v7) peers stop at ESLint **9**; ESLint **10** forces peer conflicts or `legacy-peer-deps`.
- **TypeScript 5.9.x** — `typescript-eslint` **8.57.x** peers require `typescript < 6.0.0`. **TS 6** waits on a supported **typescript-eslint** major.
- **`@types/node` ^24.x** — aligns with **`engines: node >= 24`** (not Node 25 type defs by default).

## Lint command (Next.js 16)

- **Next.js 16** removed the **`next lint`** CLI command from the default `next` binary. **`package.json`** uses **`eslint . --max-warnings 0`** with the flat **`eslint.config.js`** instead.

## Webpack vendor splits

- Production client **`splitChunks`** uses named groups (React, Next, Zustand, UI, next-intl `i18nVendor`, form, **`common`**) so dependency upgrades do not silently reshuffle critical vendors into anonymous chunks.

## i18n: next-intl SSR (2026-04-20)

- **Migrated from** `i18next` + `react-i18next` (client-only, HTTP backend to `public/locales/**`, FOUC masked via `html.i18n-*` classes) **to** `next-intl` (App Router SSR, `[locale]` dynamic segment, server-rendered translations).
- **Why:** SEO surfaces (sitemap `hreflang`, per-locale metadata, localized canonical URLs) require translations at render time, not after hydration. i18next's client-only initialization produced a flash of untranslated content on cold loads and prevented localized `generateMetadata`.
- **Structure:** `i18n/routing.ts` (`defineRouting({ locales: ['en'], defaultLocale: 'en' })`) → `i18n/request.ts` (`getRequestConfig`) → `i18n/navigation.ts` (typed `Link` / `redirect`). Document routes live under `app/[locale]/`. `proxy.ts` composes the next-intl middleware with nonce CSP + rate limit.
- **Title-template cascade:** Next.js does not apply `title.template` to the segment that defines it — only to descendants. Root `app/layout.tsx` owns the locale-independent `title.default` + `title.template`; `app/[locale]/layout.tsx` contributes only `description` / `openGraph` / `twitter`.
- **Server Actions:** translate responses via `getTranslations('namespace')`; tests mock `next-intl/server` with a messages-indexed resolver.
- **Single source:** `messages/<locale>.json`. `public/locales/**` and `shared/lib/i18n/**` were deleted. `i18nVendor` `splitChunk` regex retargeted to `/next-intl/`.
- **Locale set:** kept at `['en']` — add new locales in `routing.locales` + `messages/<locale>.json`; no other code changes required.

## Security headers (two layers)

- **`next.config.ts` `headers()`:** applies static CSP (document-safe **`script-src 'self'`** in production via **`buildStaticContentSecurityPolicy`**), HSTS (prod), frame options, COOP/CORP, Reporting-Endpoints, Permissions-Policy, etc., on **`/:path*`**.
- **`proxy.ts`:** for **`config.matcher`** paths only, sets per-request **nonce** CSP (**`strict-dynamic`** in production) on the outgoing response and forwards **`x-nonce`** on the request for handlers that need it.
- **CSP violation reporting:** policy includes `report-to csp-endpoint`; **`Reporting-Endpoints`** points at **`/api/csp-report`**; POST handler logs payloads. **`X-XSS-Protection`** omitted (deprecated).

## Public app URL (SEO)

- **`NEXT_PUBLIC_APP_URL`** is validated in **`shared/lib/env.ts`** (Zod) and drives **`metadataBase`**, sitemap URLs, and robots `sitemap` in production.

## `server-only` vs Edge proxy

- **`shared/lib/rateLimit.ts`** re-exports **`./rateLimitCore`** behind **`import 'server-only'`** for Node server imports. **`proxy.ts`** and **Vitest** import **`rateLimitCore.ts`** directly because the `server-only` package does not run in those bundles. **`shared/lib/index.ts`** does not re-export rate-limit helpers to avoid pulling `server-only` into client barrels.

## Next.js `experimental` (16.x)

- **`experimental.serverActions`:** `allowedOrigins` from **`NEXT_PUBLIC_APP_URL`** (fallback `http://localhost:3000`), **`bodySizeLimit: '1mb'`**.
- **`experimental.webVitalsAttribution`:** `['LCP', 'INP', 'CLS']` for build-time attribution hints.

## API rate limiting

- **Where it runs:** **`proxy.ts`**, only for **`config.matcher`** (currently **`/api/*`** and **`/dev/*`**). **`next-action`** is recognized inside the limiter, but widening **matcher** is required if document-route Server Actions should share the same gate.
- **Default:** in-memory prune + cap via **`rateLimitCore`** when **Upstash env is unset**.
- **Enterprise:** optional **Upstash Redis** via **`@upstash/ratelimit`** + **`UPSTASH_REDIS_REST_URL`** / **`UPSTASH_REDIS_REST_TOKEN`** — distributed quota (`shared/lib/upstashRateLimit.ts`).

## Content Security Policy (static vs nonce)

- **Default HTML:** production **`script-src 'self'`** only (static CSP from **`next.config`**); avoids **`strict-dynamic`** without a bootstrap nonce on document responses, which would break Next script loading.
- **Proxy-handled responses:** **`buildContentSecurityPolicy(nonce, …)`** adds **`strict-dynamic` + nonce** for matched routes; comment and tests in **`shared/lib/cspHeader.ts`** document the split.
- **Trade-off:** strictest nonce policy applies where the proxy runs; broadening **matcher** widens nonce CSP coverage and runtime surface—change only with intent.

## Webpack `/dev` exclusion

- **Removed:** mutating **`config.entry`** to drop `/dev` chunks (fragile on Next upgrades).
- **Replaced:** production **`proxy.ts`** returns **404** for **`/dev/*`** (within matcher); tracing excludes remain in **`outputFileTracingExcludes`** where useful.

## E2E (Playwright)

- **Config:** `playwright.config.ts` — `e2e/` specs, Chromium only; **local** uses `webServer` → `npm run dev` with `reuseExistingServer` so an existing dev server is reused; **CI** (`CI=true`) uses `npm run start` after `npm run build` for production-like runs.
- **Vitest** excludes `e2e/**` so `*.spec.ts` in `e2e/` is not picked up by unit tests.

## Verification benchmarks

- **`npm run verify:enterprise`** — full gate sequence (lint, format, tsc, test, build).
- **`npm run bench:verify`** — same steps with **per-step timings** (`scripts/bench-verify.mjs`) for local regression checks.

## Button primitive

- Base variant omits **`ring-offset-background`** (aligns with enterprise template; focus ring stays via `ring-*`).
