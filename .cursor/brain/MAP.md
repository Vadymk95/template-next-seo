# MAP — template-next-seo

## App Router

| Route / file                    | Notes                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `app/layout.tsx`                | Root layout: fonts, `<head>` preconnects, `WebVitalsReporter`, `Providers`, `Header` / `Footer` shell (static document CSP from `next.config`) |
| `app/page.tsx`                  | Home (SEO-oriented); client shell via `HomePageClient`              |
| `app/WebVitalsReporter.tsx`     | Client Web Vitals → `POST /api/vitals`                            |
| `app/not-found.tsx`             | 404                                                                |
| `app/error.tsx`                 | Error boundary                                                     |
| `app/loading.tsx`               | Segment loading UI                                                 |
| `proxy.ts` (repo root)            | Matched routes only: API rate limit (in-memory or Upstash), prod `/dev` 404, nonce CSP on the proxy response; matcher is **`/api/*`** and **`/dev/*`** |
| `app/sitemap.ts`                | Dynamic sitemap                                                    |
| `app/robots.ts`                 | robots.txt                                                         |
| `app/providers.tsx`             | Client providers (i18n shell, mount gates)                         |
| `app/example-form/`             | Example feature page + client shell                                |
| `app/dev/ui/`                   | Dev UI playground                                                  |
| `app/api/health/route.ts`       | Health check                                                       |
| `app/api/example-form/route.ts` | JSON sample API (non-browser clients; forms use Server Action)      |
| `app/api/csp-report/route.ts`   | CSP `report-to` ingest (POST)                                     |
| `app/api/vitals/route.ts`       | `sendBeacon` Web Vitals (POST → 204)                               |
| `app/global-error.tsx`          | Root catastrophic error UI                                       |
| `app/actions/example-form.ts`   | Server Action example                                              |
| `next.config.ts` (repo root)    | Static CSP + security headers on `/:path*`, experimental knobs, webpack vendor `splitChunks`, tracing/Turbopack root |

## Shared

- **`shared/lib/`**: `env` (public Zod), `i18n`, `logger`, `cspHeader` (static + nonce builders), `web-vitals`, `middlewareRequest`, `rateLimit` (Node `server-only`; see `DECISIONS`), `rateLimitCore` (Edge/tests), optional `upstashRateLimit`, `utils`, `utils-store/createSelectors`, `test-utils`.
- **`shared/ui/`**: Button, Input, layout chrome, ErrorBoundary, `WithSuspense`.
- **`shared/constants/`**, **`shared/types/`**: cross-cutting definitions.

## Features / entities

- **`features/example-form/`**: UI + model (Zod schema, types); consumed by `app/example-form`.
- **`entities/`**: FSD slot for domain stores; not shipped in this baseline (Zustand is a dependency with shared selector helpers only).

## Data flow (high level)

1. **Server**: RSC pages fetch or render static content; Server Actions / Route Handlers under `app/api`, `app/actions`.
2. **Client**: `'use client'` islands; add TanStack Query only if the app introduces it (not in default `package.json`).
3. **i18n**: Client i18next (HTTP backend to `public/locales`); `html.i18n-loading` / `html.i18n-ready` without LCP-blocking full-page opacity (see `globals.css`).
4. **Web Vitals**: Build-time attribution hints (`next.config` experimental) plus runtime `sendBeacon` ingestion at `/api/vitals` from the root reporter.

## Bundling (webpack production)

`next build --webpack` applies named client **`splitChunks`** groups (React, Next, Zustand, UI stack, i18n stack, form stack, plus a shared **`common`** group) for predictable vendor boundaries.
