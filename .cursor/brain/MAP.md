# MAP — template-next-seo

## App Router

| Route / file                    | Notes                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `app/layout.tsx`                | Root layout: fonts, `<head>` preconnects, `WebVitalsReporter`, `Providers`, static `title.default` + `title.template` (cascades to descendants); no Header/Footer here |
| `app/[locale]/layout.tsx`       | Locale segment: `generateStaticParams` from `routing.locales`, `setRequestLocale`, `getMessages` → `NextIntlClientProvider` wraps `Header` / `main` / `Footer`; `generateMetadata` sets locale-specific `description` / `openGraph` / `twitter` only (title inherits from root) |
| `app/[locale]/page.tsx`         | Home (SEO-oriented); `generateMetadata` emits `alternates.languages` per routing locale |
| `app/WebVitalsReporter.tsx`     | Client Web Vitals → `POST /api/vitals`                            |
| `app/not-found.tsx`             | 404                                                                |
| `app/error.tsx`                 | Error boundary                                                     |
| `app/loading.tsx`               | Segment loading UI                                                 |
| `proxy.ts` (repo root)            | Matched routes only: API rate limit (in-memory or Upstash), prod `/dev` 404, nonce CSP on the proxy response; matcher is **`/api/*`** and **`/dev/*`** |
| `app/sitemap.ts`                | Dynamic sitemap                                                    |
| `app/robots.ts`                 | robots.txt                                                         |
| `app/providers.tsx`             | Client providers (analytics init on load / requestIdleCallback; i18n moved to `NextIntlClientProvider` in `[locale]/layout`) |
| `app/[locale]/example-form/`    | Example feature page + client shell; localized `generateMetadata` with `alternates.languages` |
| `i18n/routing.ts`               | `defineRouting({ locales: ['en'], defaultLocale: 'en' })` — single source for locales |
| `i18n/request.ts`               | `getRequestConfig` — validates locale, loads `messages/<locale>.json` |
| `i18n/navigation.ts`            | `createNavigation(routing)` — `Link`, `redirect`, `usePathname`, `useRouter` bound to locales |
| `messages/en.json`              | Server + client translations (replaces `public/locales/en/*.json`) |
| `app/dev/ui/`                   | Dev UI playground                                                  |
| `app/api/health/route.ts`       | Health check                                                       |
| `app/api/example-form/route.ts` | JSON sample API (non-browser clients; forms use Server Action)      |
| `app/api/csp-report/route.ts`   | CSP `report-to` ingest (POST)                                     |
| `app/api/vitals/route.ts`       | `sendBeacon` Web Vitals (POST → 204)                               |
| `app/global-error.tsx`          | Root catastrophic error UI                                       |
| `app/actions/example-form.ts`   | Server Action example                                              |
| `next.config.ts` (repo root)    | Static CSP + security headers on `/:path*`, experimental knobs, webpack vendor `splitChunks`, tracing/Turbopack root |

## Shared

- **`shared/lib/`**: `env` (public Zod), `logger`, `cspHeader` (static + nonce builders), `web-vitals`, `middlewareRequest`, `rateLimit` (Node `server-only`; see `DECISIONS`), `rateLimitCore` (Edge/tests), optional `upstashRateLimit`, `utils`, `utils-store/createSelectors`, `test-utils`. (i18n helpers live under `i18n/` at repo root; `shared/lib/i18n/` was removed with the next-intl migration.)
- **`shared/ui/`**: Button, Input, layout chrome, ErrorBoundary, `WithSuspense`.
- **`shared/constants/`**, **`shared/types/`**: cross-cutting definitions.

## Features / entities

- **`features/example-form/`**: UI + model (Zod schema, types); consumed by `app/example-form`.
- **`entities/`**: FSD slot for domain stores; not shipped in this baseline (Zustand is a dependency with shared selector helpers only).

## Data flow (high level)

1. **Server**: RSC pages fetch or render static content; Server Actions / Route Handlers under `app/api`, `app/actions`.
2. **Client**: `'use client'` islands; add TanStack Query only if the app introduces it (not in default `package.json`).
3. **i18n**: next-intl SSR — `proxy.ts` composes next-intl middleware for document routes (locale redirect / rewrite), `[locale]` segment calls `setRequestLocale` + `getMessages`, server uses `getTranslations`, client islands use `useTranslations` inside `NextIntlClientProvider`. Single source: `messages/<locale>.json`.
4. **Web Vitals**: Build-time attribution hints (`next.config` experimental) plus runtime `sendBeacon` ingestion at `/api/vitals` from the root reporter.

## Bundling (webpack production)

`next build --webpack` applies named client **`splitChunks`** groups (React, Next, Zustand, UI stack, next-intl `i18nVendor`, form stack, plus a shared **`common`** group) for predictable vendor boundaries.
