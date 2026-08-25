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
| Server state  | Server Components / Route Handlers; add TanStack Query in-repo if needed                                                      |
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

Imports use the `@/*` path alias (repo root).

## Build & dev

- **Production build**: `npm run build` → `next build --webpack` (custom `webpack` splits require webpack; see `DECISIONS.md`).
- **Optional**: `npm run build:turbo` for Turbopack-only experiments (no custom webpack chunks).
- **Dev**: `npm run dev` (Turbopack); `npm run dev:webpack` if webpack parity is needed.

## Local gate

- **`npm run verify:iter`** — the iteration rung: oxlint → tsc (incremental) → `vitest --changed` (seconds). Run per change; the gate runs ONCE before hand-over.
- **`npm run verify` / `verify:enterprise`** — every OFFLINE check: `check-gate-env` preflight (build env + free e2e port, prints the fix) → format → typecheck → lint (cached; cheap independent stages first) → **`test:coverage`** → build → `ensure-playwright` → **`test:e2e:prod`** (Playwright vs `next start`, `PLAYWRIGHT_PROD_SERVER=1` — real `CI` keeps retries and the single worker).
- **`npm run verify:ci`** — `audit:gate && verify`. Husky **pre-push** runs this, and the CI `validate` job is one step over the same script. `verify` is a strict superset of CI's offline checks, so a green `verify` predicts a green `validate` — keep that true by adding new checks to the SCRIPT, never only to the workflow.
- **`npm run verify:full`** — `verify:ci && smoke:dev`. The only local command that also predicts the `dev-smoke` job. Run it before a PR touching routing, i18n, `proxy.ts` or `next.config.ts`.
- **`npm run fix`** — the one remedy: `oxlint --fix` → `eslint --fix` → `prettier --write`, repo-wide.
- **`.env.local` is a bootstrap step, not optional**: `verify` builds, and the production build requires `NEXT_PUBLIC_APP_URL`. `cp .env.example .env.local` once. `scripts/check-build-env.mjs` runs before the build and reports the fix in one line instead of letting a Zod error surface from inside page-data collection; it reads `.env*` via `@next/env` so its view of the env matches the build's.
- Playwright browsers install on demand via `scripts/ensure-playwright.mjs`, which reads the exact build paths out of `playwright install --dry-run`.
- **Pre-commit** is repo-scoped: `lint-staged` on the staged set, then the TDD sibling gate, then repo-wide `lint:oxlint` + `format:check` — because `lint-staged` restores unstaged hunks after fixing, which used to leave already-fixed files uncommitted.

## CI

Two jobs, in parallel.

**`validate`** — Node 24.x, `npm ci --ignore-scripts`, Next and Playwright caches, then a single **`npm run verify:ci`** step. One step on purpose: the script is the gate, and a check added to the workflow instead of the script is what made the local gate stop predicting CI.

**`dev-smoke`** — `npm run smoke:dev` against a cold Turbopack dev server. It exists because `dev` runs Turbopack while `build` runs webpack with a custom `splitChunks` hook, so `validate` only ever exercises the webpack output. It is a separate job rather than a gate step because a cold Turbopack boot costs 10-30s per run.

**`security.yml`** (separate workflow) — gitleaks over full history plus CodeQL `security-extended`, on push, PR and a weekly cron. CodeQL needs GitHub code scanning, which is free on public repos and paid on private ones; the workflow header spells out what a private fork must do. Exclusions live in `.github/codeql/codeql-config.yml` with their reason.

Root **`.npmrc`** sets `ignore-scripts=true`, `engine-strict=true`, `min-release-age=3`.
