# CLAUDE.md — template-next-seo

Operating contract for any AI agent editing this repo. Read in full before the first
change. Brain docs hold the detail; this file holds the rules that keep agents from
drifting away from them.

## Mission

SEO-first Next.js 16 App Router template with **next-intl SSR**, FSD layering,
split static + nonce CSP, Upstash-ready rate limiting, and a forkable scaffolding
pattern. This is a **template, not a shipped product** — several deps/files exist
as load-bearing examples, not dead code (see Danger Zones).

## Stack (pinned)

| Layer     | Choice                                                         |
| --------- | -------------------------------------------------------------- |
| Runtime   | Node **≥ 24** (`engine-strict=true`)                           |
| Framework | Next.js **16** App Router (`build --webpack`, not Turbo)       |
| UI        | React **19**, Tailwind **v4**, shadcn-style `shared/ui/*`      |
| Lang      | TypeScript **5.9** strict                                      |
| State     | Zustand + `shared/lib/utils-store/createSelectors`             |
| Forms     | react-hook-form + Zod                                          |
| i18n      | **next-intl 4.9** (SSR, `[locale]` segment, `messages/*.json`) |
| Tests     | Vitest + Testing Library (`test/`), Playwright (`e2e/`)        |
| Lint      | Oxlint → ESLint 9 (flat) → Prettier                            |

Detail: @.cursor/brain/PROJECT_CONTEXT.md

## Invariants (do not violate)

1. **Scope lock.** Change only what the task requires. No "while I'm here" edits,
   no opportunistic refactors, no new abstractions for single use sites. If the
   user asked for a bug fix, don't reorganize neighbours.
2. **One task = one commit.** Conventional Commits, **≤ 96 chars** on the subject
   line. No `Co-authored-by` tags. Never skip hooks (no `--no-verify`).
3. **`verify:enterprise` is the gate.** Every commit must pass
   `npm run verify:enterprise` locally before it lands. CI runs the same plus
   Playwright. A green gate is a hard precondition, not a nice-to-have.
4. **English only in code, comments, commits, docs.** Chat may be Russian; the
   repo is not.
5. **Locale set stays `['en']`** until the caller explicitly asks to expand it.
   See **Adding Languages** in `README.md` for the full procedure.
6. **Never push to `master`.** Work on feature branches; open a PR. Never
   force-push a shared branch.
7. **Security surface is frozen** unless the task is explicitly security work:
   don't touch CSP directives in `next.config.ts`, the nonce pipeline in
   `proxy.ts`, the rate-limit matcher, or COOP/CORP headers.
8. **Template scaffolding is protected** — see Danger Zones.

## Commands (exact)

```bash
npm run dev                 # Turbopack dev (fast)
npm run dev:webpack         # webpack parity dev (debug splitChunks)
npm run build               # next build --webpack (production)
npm run build:analyze       # ANALYZE=true webpack build, opens bundle analyzer
npm run verify:enterprise   # lint → format:check → tsc → vitest → build (commit gate)
npm run test                # vitest run
npm run test:e2e            # Playwright (builds + serves prod implicitly)
npm run lint                # oxlint → eslint, --max-warnings 0
npm run type-check          # tsc --noEmit
```

`verify:enterprise` is authoritative. If it fails, fix the cause — do **not**
downgrade rules, silence warnings, or add `eslint-disable`. If a rule is wrong
for a real reason, raise it with the caller first.

## Architecture

Four FSD layers with one-way imports: `app → features → entities → shared`.
Absolute imports via `@/*` (repo root). No deep relative paths across layers.
No circular barrels.

- **`app/`** — routes, layouts, Server Actions, API route handlers.
- **`features/`** — feature slices (`model/` Zod schemas + types, `ui/` client
  components). Canonical example: `features/example-form`.
- **`entities/`** — domain slices (empty in baseline; add when you have them).
- **`shared/`** — UI kit (`ui/`), `lib/`, constants, types, utils.

Full file map: @.cursor/brain/MAP.md

## i18n contract (next-intl SSR)

- **Single source of truth:** `messages/<locale>.json`. No `public/locales/*`,
  no client-side JSON fetches.
- **Locale segment:** routes live under `app/[locale]/*`. Every page + layout
  entry narrows the route param via `requireLocale()` from
  `@/i18n/request-locale`, then calls `setRequestLocale(locale)` **before** any
  client descendant renders.
- **Type safety:** `global.d.ts` augments `next-intl`'s `AppConfig` with
  `Locale` (from `routing.locales`) and `Messages` (from `messages/en.json`).
  All `useTranslations('ns')` / `t('key')` calls are compile-time checked.
- **Title cascade quirk:** `title.template` does **not** apply to the segment
  that defines it, only to descendants. Root `app/layout.tsx` owns
  `title.default` + `title.template`; `app/[locale]/layout.tsx` sets only
  `description` / `openGraph` / `twitter`. Do not move the template down.
- **hreflang:** every localized route's `generateMetadata` builds
  `alternates.languages` from `routing.locales`; `app/sitemap.ts` mirrors them
  as `<xhtml:link>` entries.
- **Server Actions** use `getTranslations({ locale })` for user-facing strings.

Detail: @.cursor/brain/DECISIONS.md (ADR "i18n: next-intl SSR")

## Security contract

- **Static document CSP** lives in `next.config.ts` `headers()` and applies to
  all document routes. **Nonce CSP with `strict-dynamic`** lives in `proxy.ts`
  and applies only to the matcher (`/api/:path*`, `/dev/:path*`, and the
  broad document matcher that excludes `_next`, `_vercel`, static assets).
- **`proxy.ts` composes** next-intl middleware + nonce CSP + rate limit +
  `/dev` production-gate in a specific order. Do not reorder. Do not add a
  branch **before** the rate limiter — it gates on `isApi || isServerAction`
  and must see every protected surface.
- **Rate limit:** Upstash if `UPSTASH_REDIS_REST_URL` + `…_TOKEN` are set,
  otherwise in-memory per-isolate fallback. Matcher coverage is the only
  guarantee — verify before assuming a route is throttled.
- **COOP/CORP `same-origin`** may break OAuth popups; use same-tab redirects.

Detail: @.cursor/brain/SKELETONS.md (sections "`proxy` composition", "strict CSP")

## Danger zones

Read before editing these:

- **`next.config.ts`** — custom webpack `splitChunks` (react/next/i18n/ui/form
  vendors); broken by `next build` without `--webpack`. Don't assume Turbopack
  parity for chunk names.
- **`proxy.ts`** — security-critical composition; see Security contract above.
- **`app/[locale]/*`** — every entry needs `setRequestLocale` before client
  descendants; missing calls swallow errors as `Error(void 0)` in prerender.
- **Template scaffolding** — `lucide-react`, `shared/constants/index.ts`,
  `features/example-form/**`, Web Vitals pipeline. These are load-bearing
  examples; the inline `// Template scaffolding` comments mark each site. Do
  not strip as "unused" unless the caller confirms "this is now my MVP".

Full list with risks + mitigations: @.cursor/brain/SKELETONS.md

## Brain docs (entry points)

- @.cursor/brain/PROJECT_CONTEXT.md — purpose, stack, layout, CI
- @.cursor/brain/MAP.md — every route, file, and responsibility
- @.cursor/brain/SKELETONS.md — danger zones
- @.cursor/brain/DECISIONS.md — ADRs (why things are the way they are)
- @.cursor/brain/DICTIONARY.md — project-specific vocabulary
- @README.md — user-facing docs (setup, adding languages, restore playbook)

Consult them before acting on an unfamiliar area; they are the authoritative
"why" that git history doesn't capture.

## Out of scope (ask before touching)

- Adding or removing locales, or changing `routing.defaultLocale`.
- Changing CSP directives, nonce pipeline, rate-limit matcher, or COOP/CORP.
- Node engine bump (`package.json` `engines.node`) or `.npmrc` hardening flags.
- Removing anything tagged `// Template scaffolding` or listed in the
  "restore playbook" in `README.md`.
- Adding analytics/telemetry vendors or expanding `app/api/vitals` beyond log.
- Switching build tool (webpack ↔ Turbopack) for the default `build` script.

When unsure whether a change is in scope, state the intent and wait for
confirmation. Saying "I don't know" is preferable to guessing.

## Response discipline

- End any non-trivial implementation with a one-line
  `Confidence: HIGH | MEDIUM | LOW — reason`.
- Cite `path/to/file.ts:LINE` for code claims so the caller can verify.
- Prefer editing existing files over creating new ones.
- Never write emojis unless asked.
