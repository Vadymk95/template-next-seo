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

- **Oxlint:** CLI `oxlint` + `.oxlintrc.json` — fast first pass (react + typescript plugins, core JS rules). `npm run lint` runs **`lint:oxlint` then `eslint`**. Overrides for tests, e2e, scripts, middleware, logger/web-vitals (no-console off where intentional).
- **ESLint base:** `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, TanStack Query flat preset, then **`eslint-plugin-oxlint` `flat/all`** (disables ESLint rules already covered by oxlint so custom severities win).
- **Imports:** **`eslint-plugin-import-x`** + `eslint-import-resolver-typescript` via `import-x/resolver-next` — `import-x/order`, `import-x/no-cycle`, recommended import-x rules.
- **React:** **`eslint-plugin-react`** — flat recommended + `jsx-runtime`, plus `react/no-array-index-key`, `no-unstable-nested-components`, `jsx-no-useless-fragment`, `self-closing-comp`; `react/prop-types` off (TypeScript).
- **Type-aware strictness:** `parserOptions.projectService` + `@typescript-eslint/no-floating-promises`, `no-misused-promises` with **`checksVoidReturn.attributes: false`** (React event/async handlers), `no-import-type-side-effects`, `switch-exhaustiveness-check`.
- **Imports / style:** `no-restricted-imports` — no `FC`; parent-relative `../` banned in favor of `@/`.
- **Prettier in ESLint:** **`eslint-plugin-prettier/recommended`** (last config block) so `prettier/prettier` runs as an ESLint rule.
- **Playwright / e2e:** `typescript-eslint` `disableTypeChecked` + `import-x/order` & `import-x/no-cycle` off.
- **Not enabled:** `func-style: expression` globally — Next idioms use `export async function` for routes, middleware, and Server Actions; enabling would fight the framework.

## ESLint & TypeScript majors (hold)

- **ESLint 9.x** — `eslint-plugin-react-hooks` (v5/v7) peers stop at ESLint **9**; ESLint **10** forces peer conflicts or `legacy-peer-deps`.
- **TypeScript 5.9.x** — `typescript-eslint` **8.57.x** peers require `typescript < 6.0.0`. **TS 6** waits on a supported **typescript-eslint** major.
- **`@types/node` ^24.x** — aligns with **`engines: node >= 24`** (not Node 25 type defs by default).

## Lint command (Next.js 16)

- **Next.js 16** removed the **`next lint`** CLI command from the default `next` binary. **`package.json`** uses **`eslint . --max-warnings 0`** with the flat **`eslint.config.js`** instead.

## Vendor chunk: TanStack Query

- Webpack `splitChunks` **`stateVendor`** includes **`@tanstack/query-core`** so query core does not silently land in the wrong chunk when package layout changes.

## Security headers (single source)

- **Decision:** route security headers (CSP, HSTS, frame options, Reporting-Endpoints, etc.) live only in **`middleware.ts`** at the repo root (Next convention). **`next.config.ts`** no longer duplicates subset headers — avoids drift and conflicting values.
- **CSP violation reporting:** `Content-Security-Policy` includes `report-to csp-endpoint`; **`Reporting-Endpoints: csp-endpoint="/api/csp-report"`**; POST handler at **`app/api/csp-report/route.ts`** logs payloads. **`X-XSS-Protection`** removed (deprecated; CSP replaces it).

## Server Actions rate limiting

- **Decision:** the same **`enforceApiRateLimit`** logic as **`/api/*`** applies when the request carries the **`next-action`** header (Server Action POSTs), so action endpoints share the in-memory / Upstash quota.

## Public app URL (SEO)

- **`NEXT_PUBLIC_APP_URL`** is validated in **`shared/lib/env.ts`** (Zod) and drives **`metadataBase`**, sitemap URLs, and robots `sitemap` in production.

## `server-only` vs Edge middleware

- **`shared/lib/rateLimit.ts`** re-exports **`./rateLimitCore`** behind **`import 'server-only'`** for Node server imports. **Edge middleware** and **Vitest** import **`rateLimitCore.ts`** directly because the `server-only` package does not run in those bundles. **`shared/lib/index.ts`** no longer re-exports rate-limit helpers to avoid pulling `server-only` into client barrels.

## Next.js `experimental` (16.x)

- **`experimental.serverActions`:** `allowedOrigins` from **`NEXT_PUBLIC_APP_URL`** (fallback `http://localhost:3000`), **`bodySizeLimit: '1mb'`**.
- **`experimental.webVitalsAttribution`:** `['LCP', 'INP', 'CLS']` for build-time attribution hints.

## API rate limiting

- **Default:** **`shared/lib/rateLimit.ts`** (prune + cap) when **Upstash env is unset**.
- **Enterprise:** optional **Upstash Redis** via **`@upstash/ratelimit`** + **`UPSTASH_REDIS_REST_URL`** / **`UPSTASH_REDIS_REST_TOKEN`** — one limiter across isolates and regions (`shared/lib/upstashRateLimit.ts`).

## Content Security Policy (nonce)

- **Production `script-src`:** `'strict-dynamic' 'nonce-<per-request>'` built in **`shared/lib/cspHeader.ts`**. Middleware forwards **`x-nonce`** on the request; **`app/layout.tsx`** reads **`headers()`** and sets **`nonce`** on **`<html>`** for framework compatibility.
- **Trade-off:** root layout is **dynamic** (uses `headers()`), so HTML routes that depended on static ISR at the layout level become **on-demand server-rendered** (`ƒ` in build output). Acceptable for strict CSP; **`sitemap` / `robots`** can remain static.

## Webpack `/dev` exclusion

- **Removed:** mutating **`config.entry`** to drop `/dev` chunks (fragile on Next upgrades).
- **Replaced:** production **middleware** returns **404** for **`/dev/*`**; tracing excludes remain in **`outputFileTracingExcludes`** where useful.

## E2E (Playwright)

- **Config:** `playwright.config.ts` — `e2e/` specs, Chromium only; **local** uses `webServer` → `npm run dev` with `reuseExistingServer` so an existing dev server is reused; **CI** (`CI=true`) uses `npm run start` after `npm run build` for production-like runs.
- **Vitest** excludes `e2e/**` so `*.spec.ts` in `e2e/` is not picked up by unit tests.

## Verification benchmarks

- **`npm run verify:enterprise`** — full gate sequence (lint, format, tsc, test, build).
- **`npm run bench:verify`** — same steps with **per-step timings** (`scripts/bench-verify.mjs`) for local regression checks.

## Button primitive

- Base variant omits **`ring-offset-background`** (aligns with enterprise template; focus ring stays via `ring-*`).
