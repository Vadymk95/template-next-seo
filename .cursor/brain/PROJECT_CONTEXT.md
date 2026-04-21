# template-next-seo — Project Context

## Purpose

Next.js App Router template focused on **SEO** (sitemap, robots, `hreflang`), **next-intl SSR**, **Zustand-ready** shared helpers, and **FSD-style** layering. Copy, rename, extend.

## Tech Stack

| Layer         | Choice                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Framework     | Next.js **16** (App Router)                                                             |
| UI            | React **19**                                                                            |
| Language      | TypeScript **5.9** strict                                                               |
| Styling       | Tailwind CSS **v4** (`app/globals.css`, PostCSS)                                        |
| Components    | shadcn-style primitives under `shared/ui/`                                              |
| Global state  | Zustand + `shared/lib/utils-store/createSelectors` (no default entity store)              |
| Server state  | Server Components / Route Handlers; add TanStack Query in-repo if needed              |
| Forms         | react-hook-form + Zod                                                                   |
| i18n          | next-intl (App Router SSR; `[locale]` segment; `messages/<locale>.json`)                 |
| Tests         | Vitest + Testing Library; Playwright E2E (`e2e/`, `npm run test:e2e`)                    |
| Lint / format | ESLint **9** (flat) + **Oxlint** + Prettier **3** (`npm run lint` = oxlint → eslint)     |
| Security      | Static document CSP + nonce **`strict-dynamic`** on **`proxy`** matcher paths, COOP/CORP, optional **Upstash** in **`proxy`** |

## Layout (FSD-ish)

| Path        | Role                                                   |
| ----------- | ------------------------------------------------------ |
| `app/`      | Routes, layouts, providers, Server Actions, API routes |
| `features/` | Feature slices (e.g. `example-form`)                   |
| `entities/` | Optional domain slices (directory is created on first domain extraction) |
| `shared/`   | UI kit, `lib/`, constants, types                       |

Imports use the `@/*` path alias (repo root).

## Build & dev

- **Production build**: `npm run build` → `next build --webpack` (custom `webpack` splits require webpack; see `DECISIONS.md`).
- **Optional**: `npm run build:turbo` for Turbopack-only experiments (no custom webpack chunks).
- **Dev**: `npm run dev` (Turbopack); `npm run dev:webpack` if webpack parity is needed.

## CI

GitHub Actions on **Node 24.x**: **`npm ci --ignore-scripts`** → `npm audit --audit-level=moderate` → lint → format check → `tsc --noEmit` → unit tests → cached **`npm run build`** → Playwright Chromium install → **`npm run test:e2e`** with **`CI=true`** (production server). Root **`.npmrc`** sets `ignore-scripts=true`, `engine-strict=true`, etc.
