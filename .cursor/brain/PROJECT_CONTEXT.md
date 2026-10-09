# template-next-seo — Project Context

## Purpose

Next.js App Router template focused on **SEO** (sitemap, robots, `hreflang`), **next-intl SSR**, **Zustand-ready** shared helpers, and **FSD-style** layering. Copy, rename, extend.

## Tech Stack

| Layer         | Choice                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Framework     | Next.js **16** (App Router)                                                                                                   |
| UI            | React **19**                                                                                                                  |
| Language      | TypeScript **6.0** strict                                                                                                     |
| Styling       | Tailwind CSS **v4** (`app/globals.css`, PostCSS)                                                                              |
| Components    | shadcn-style primitives under `shared/ui/`                                                                                    |
| Global state  | Zustand + `shared/lib/utils-store/createSelectors` (no default entity store)                                                  |
| Server state  | Server Components / Route Handlers; add TanStack Query in-repo if needed (`.cursor/brain/EXTENSIONS.md` Phase 1d)             |
| Forms         | react-hook-form + Zod                                                                                                         |
| i18n          | next-intl (App Router SSR; `[locale]` segment; `messages/<locale>.json`)                                                      |
| Tests         | Vitest + Testing Library; Playwright E2E (`e2e/`; local `test:e2e`, gate/CI `test:e2e:prod`)                                  |
| Lint / format | ESLint **10** (flat) + **Oxlint** + Prettier **3** (`npm run lint` = oxlint → eslint)                                         |
| Security      | Static document CSP + nonce **`strict-dynamic`** on **`proxy`** matcher paths, COOP/CORP, optional **Upstash** in **`proxy`** |

## Layout (FSD-ish)

| Path        | Role                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `app/`      | Routes, layouts, providers, Server Actions, API routes                   |
| `features/` | Feature slices (e.g. `example-form`)                                     |
| `entities/` | Optional domain slices (directory is created on first domain extraction) |
| `shared/`   | UI kit, `lib/`, constants, types                                         |

Imports use the `@/*` path alias (repo root). The file-by-file map is `MAP.md`.

## Build, gate and CI

- **Build:** `npm run build` is `next build --webpack` (the custom `splitChunks` need webpack); `dev` runs Turbopack, `dev:webpack` is the parity run. Why: `DECISIONS.md` § "Build and styling basics".
- **Gate:** defined once, in `AGENTS.md` § Commands (exact) › _The tier law_; stage timings and what was deliberately not added are in `VERIFICATION.md`. `.env.local` is a bootstrap step (`cp .env.example .env.local`), see `README.md` § Environment Variables.
- **CI (`ci.yml`)** runs in parallel: `validate` (one `npm run verify:ci` step: the script is the gate, so a check added to the workflow instead of the script is what stops the local gate predicting CI), `dev-smoke` (`npm run smoke:dev` against a cold Turbopack server, because `build` is webpack and `validate` never exercises Turbopack output) and `cross-browser` (`CROSS_BROWSER=1`, Firefox and WebKit geometry specs; `DECISIONS.md` § "Cross-engine coverage").
- **`security.yml`** (separate workflow): gitleaks, CodeQL `security-extended` and a zizmor audit of the workflows, on push, PR and a weekly cron. CodeQL needs GitHub code scanning (free on public repos, paid on private); the workflow header says what a private fork must do. There is no CodeQL exclusion file; add one only when an alert has a real reason to be ignored, and write that reason in it.
