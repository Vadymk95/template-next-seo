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

## ESLint major version

- Stay on **ESLint 9.x** with **`typescript-eslint` 8.x** until a single supported upgrade path exists (same constraint as sibling templates).

## Lint command (Next.js 16)

- **Next.js 16** removed the **`next lint`** CLI command from the default `next` binary. **`package.json`** uses **`eslint . --max-warnings 0`** with the flat **`eslint.config.js`** instead.

## Vendor chunk: TanStack Query

- Webpack `splitChunks` **`stateVendor`** includes **`@tanstack/query-core`** so query core does not silently land in the wrong chunk when package layout changes.

## Security headers (single source)

- **Decision:** route security headers (CSP, HSTS, frame options, etc.) live only in **`app/middleware.ts`**. **`next.config.ts`** no longer duplicates subset headers — avoids drift and conflicting values.

## API rate limiting

- **Default:** **`shared/lib/rateLimit.ts`** (prune + cap) when **Upstash env is unset**.
- **Enterprise:** optional **Upstash Redis** via **`@upstash/ratelimit`** + **`UPSTASH_REDIS_REST_URL`** / **`UPSTASH_REDIS_REST_TOKEN`** — one limiter across isolates and regions (`shared/lib/upstashRateLimit.ts`).

## Content Security Policy (nonce)

- **Production `script-src`:** `'strict-dynamic' 'nonce-<per-request>'` built in **`shared/lib/cspHeader.ts`**. Middleware forwards **`x-nonce`** on the request; **`app/layout.tsx`** reads **`headers()`** and sets **`nonce`** on **`<html>`** for framework compatibility.
- **Trade-off:** root layout is **dynamic** (uses `headers()`), so HTML routes that depended on static ISR at the layout level become **on-demand server-rendered** (`ƒ` in build output). Acceptable for strict CSP; **`sitemap` / `robots`** can remain static.

## Webpack `/dev` exclusion

- **Removed:** mutating **`config.entry`** to drop `/dev` chunks (fragile on Next upgrades).
- **Replaced:** production **middleware** returns **404** for **`/dev/*`**; tracing excludes remain in **`outputFileTracingExcludes`** where useful.

## Verification benchmarks

- **`npm run verify:enterprise`** — full gate sequence (lint, format, tsc, test, build).
- **`npm run bench:verify`** — same steps with **per-step timings** (`scripts/bench-verify.mjs`) for local regression checks.

## Button primitive

- Base variant omits **`ring-offset-background`** (aligns with enterprise template; focus ring stays via `ring-*`).
