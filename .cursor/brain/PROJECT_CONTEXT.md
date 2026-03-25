# template-next-seo — Project Context

## Purpose

Next.js App Router template focused on **SEO** (sitemap, robots), **i18n**, **TanStack Query**, **Zustand**, and **FSD-style** layering. Copy, rename, extend.

## Tech Stack

| Layer         | Choice                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Framework     | Next.js **16** (App Router)                                                             |
| UI            | React **19**                                                                            |
| Language      | TypeScript **5.9** strict                                                               |
| Styling       | Tailwind CSS **v4** (`app/globals.css`, PostCSS)                                        |
| Components    | shadcn-style primitives under `shared/ui/`                                              |
| Global state  | Zustand + `shared/lib/utils-store/createSelectors`                                      |
| Server state  | TanStack Query (`@tanstack/react-query`)                                                |
| Forms         | react-hook-form + Zod                                                                   |
| i18n          | i18next + react-i18next (+ middleware)                                                  |
| Tests         | Vitest + Testing Library                                                                |
| Lint / format | ESLint **9** (flat) + Prettier **3**                                                    |
| Security      | CSP nonce + **`strict-dynamic`** (prod), COOP/CORP, optional **Upstash** API rate limit |

## Layout (FSD-ish)

| Path        | Role                                                   |
| ----------- | ------------------------------------------------------ |
| `app/`      | Routes, layouts, providers, Server Actions, API routes |
| `features/` | Feature slices (e.g. `example-form`)                   |
| `entities/` | Domain entities (e.g. `user` store + types)            |
| `shared/`   | UI kit, `lib/`, constants, types                       |

Imports use the `@/*` path alias (repo root).

## Build & dev

- **Production build**: `npm run build` → `next build --webpack` (custom `webpack` splits require webpack; see `DECISIONS.md`).
- **Optional**: `npm run build:turbo` for Turbopack-only experiments (no custom webpack chunks).
- **Dev**: `npm run dev` (Turbopack); `npm run dev:webpack` if webpack parity is needed.

## CI

GitHub Actions: install → `npm audit --audit-level=moderate` → lint → format check → `tsc --noEmit` → tests → `npm run build` (no analyzer in CI).
