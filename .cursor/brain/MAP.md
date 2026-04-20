# MAP — template-next-seo

## App Router

| Route / file                    | Notes                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `app/layout.tsx`                | Root layout: CSP nonce (`headers()`), fonts, `<head>` preconnects, `WebVitalsReporter`, `Providers`, `Header` / `Footer` shell      |
| `app/page.tsx`                  | Home (SEO-oriented); client shell via `HomePageClient`              |
| `app/WebVitalsReporter.tsx`     | Client Web Vitals → `POST /api/vitals`                            |
| `app/not-found.tsx`             | 404                                                                |
| `app/error.tsx`                 | Error boundary                                                     |
| `app/loading.tsx`               | Segment loading UI                                                 |
| `middleware.ts` (repo root)     | CSP nonce, security headers, API + Server Action rate limit, prod `/dev` 404 |
| `app/sitemap.ts`                | Dynamic sitemap                                                    |
| `app/robots.ts`                 | robots.txt                                                         |
| `app/providers.tsx`             | Client providers (Query, i18n, etc.)                               |
| `app/example-form/`             | Example feature page + client shell                                |
| `app/dev/ui/`                   | Dev UI playground                                                  |
| `app/api/health/route.ts`       | Health check                                                       |
| `app/api/example-form/route.ts` | JSON sample API (non-browser clients; forms use Server Action)      |
| `app/api/csp-report/route.ts`   | CSP `report-to` ingest (POST)                                     |
| `app/api/vitals/route.ts`       | `sendBeacon` Web Vitals (POST → 204)                               |
| `app/global-error.tsx`          | Root catastrophic error UI                                       |
| `app/actions/example-form.ts`   | Server Action example                                              |

## Shared

- **`shared/lib/`**: `env` (public Zod), `queryClient`, `i18n`, `logger`, `cspHeader`, `web-vitals`, `middlewareRequest`, `rateLimit` (Node; see `DECISIONS`), optional `upstashRateLimit`, `utils`, `test-utils`.
- **`shared/ui/`**: Button, Input, layout chrome, ErrorBoundary, `WithSuspense`.
- **`shared/constants/`**, **`shared/types/`**: cross-cutting definitions.

## Features / entities

- **`features/example-form/`**: UI + model (Zod schema, types); consumed by `app/example-form`.
- **`entities/user/`**: `userStore` (Zustand) + types; re-export via `entities/user/index.ts`.

## Data flow (high level)

1. **Server**: RSC pages fetch or render static content; Server Actions / Route Handlers under `app/api`, `app/actions`.
2. **Client**: `'use client'` islands use TanStack Query for server state and Zustand for client-global state (e.g. user).
3. **i18n**: Middleware + client i18next; `html.i18n-loading` / `html.i18n-ready` toggled without LCP-blocking full-page opacity (see `globals.css`).
4. **Web Vitals**: Build-time attribution hints (`next.config` experimental) plus runtime `sendBeacon` ingestion at `/api/vitals` from the root reporter.

## Bundling (webpack production)

`next.config.ts` optionally splits **`@tanstack/query-core`** (and related vendor chunks) when using **`next build --webpack`**.
