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

## ESLint & TypeScript majors (hold — re-evaluated 2026-05-22)

- **ESLint 9.x (HOLD)** — Snapshot 2026-05-22: ESLint 10.0.0 shipped 2026-02-09; latest 10.4.0 shipped 2026-05-15. ESLint 9.x EOL is 2026-08-06 (`maintenance` dist-tag `9.39.4`). `eslint-plugin-react@7.37.5` (latest stable) peers stop at ESLint **`^9.7`**; `eslint-plugin-jsx-a11y@6.10.2` peers stop at **`^9`**. ESLint 10 removed `context.getFilename()` + `sourceCode.isSpaceBetweenTokens` + `sourceCode.getAllComments` + RuleTester `type` field — `eslint-plugin-react@7.x` calls these at runtime (crash, not warning). Other plugins (`eslint-plugin-react-hooks@7.1.1`, `typescript-eslint@8.59.x`, `eslint-plugin-react-refresh`, `eslint-plugin-import-x`, `eslint-config-next`) already accept ESLint **10**. `eslint-plugin-react@7.8.0-rc.0` shipped with a broken peer (`^3 || ^4` only), so the RC is not viable. PR #3979 (eslint-plugin-react ESLint 10) blocked transitively by `import-js/eslint-plugin-import#3230`; PR #1081 (eslint-plugin-jsx-a11y) awaiting `ljharb` review since Mar 2026. Re-evaluate monthly starting 2026-07-01 (1-month buffer pre-EOL). Plan B if upstream still blocked: switch to `@eslint-react/eslint-plugin@5.8.4+` (peer `eslint ^10.3.0`, requires Node ≥22, NOT drop-in — config rewrite ~3-5h) + `eslint-plugin-jsx-a11y-x@0.2.0+` (es-tooling org, drop-in).
- **TypeScript 6.0.x (ACTIVE — bumped 2026-05-09)** — `typescript-eslint@8.59.2` peer relaxed to `>=4.8.4 <6.1.0`, unblocking TS 6.0.x. Repo bumped from `~5.9.3` → `~6.0.3`. Keep within `~6.0.x` until `typescript-eslint` ships its next major widening the upper bound.
- **`@types/node` ^24.x** — aligns with **`engines: node >= 24`** (not Node 25 type defs by default). Latest 24.x patch is `24.12.4` (snapshot 2026-05-22). Dependabot config (`.github/dependabot.yml`) ignores @types/node ≥25.

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

## API and Server Action rate limiting

- **Where it runs:** **`proxy.ts`**, on **`config.matcher`** (`/api/:path*`, `/dev/:path*`, and broad non-asset document paths). Limiter applies when request is API (`/api/**`) or carries `next-action`, so document-route Server Actions are covered once they traverse the matcher.
- **Default:** in-memory prune + cap via **`rateLimitCore`** when **Upstash env is unset**.
- **Enterprise:** optional **Upstash Redis** via **`@upstash/ratelimit`** + **`UPSTASH_REDIS_REST_URL`** / **`UPSTASH_REDIS_REST_TOKEN`** — distributed quota (`shared/lib/upstashRateLimit.ts`).

## Content Security Policy: nonce on dynamic, `'unsafe-inline'` on ISR (2026-05-09)

The template runs **two** CSP strategies in parallel because Next.js 16 RSC has
no nonce path for ISR'd HTML:

- **ISR / static document routes** (`/[locale]`, `/[locale]/example-form`,
  `/sitemap.xml`, `/robots.txt`, `/dev/ui` in dev): `script-src 'self'
  'unsafe-inline'` from `next.config.ts` `headers()` via
  `buildStaticContentSecurityPolicy`. Required because Next emits inline
  `<script>self.__next_f.push(...)` scripts into prerendered HTML at BUILD
  time; ISR HTML is cached and a per-request nonce in the response header
  never reaches those cached `<script>` tags. Per Next.js docs CSP guide,
  "Nonces only support dynamic routes." Hash-based CSP for the inline
  scripts is impractical because the `__next_f.push` payload differs per
  page (infinite hashes). The XSS surface is constrained by the rest of
  the policy: `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `connect-src 'self'`, `form-action 'self'`.

- **Dynamic routes** (`/api/*`, `/dev/*`): `script-src 'strict-dynamic'
  'nonce-<random>'` from `proxy.ts` via `buildContentSecurityPolicy`.
  Each request gets a fresh nonce; Next renders fresh HTML server-side
  and (when given the `x-nonce` request header in middleware) automatically
  attaches `nonce` to its inline scripts. Strictest setting available for
  routes that can support it.

- **Why not nonce everywhere?** Tried in commit history (proxy briefly applied
  nonce CSP to document routes via mutated request headers + `intlMiddleware`).
  Empirical curl on production server: HTML still had 0 `<script nonce=...>`
  attributes — ISR cache served prerendered HTML without nonce, the response
  header just announced a nonce that nothing matched → all 8 inline
  `__next_f` scripts blocked by browser → hydration broken. Reverted
  document-route CSP to the static `'unsafe-inline'` path; nonce kept only
  for the dynamic surface where it actually works.

- **Trade-off:** `'unsafe-inline'` weakens the ISR surface against inline-script
  injection. The ISR'd HTML is server-prerendered with no user input in inline
  scripts by design. Forks that ship user-generated content into ISR routes
  must either escape strictly or move to a dynamic route + nonce CSP.

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
