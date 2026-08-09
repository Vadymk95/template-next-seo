# template-next-seo — agent guide

Operating contract for any AI agent editing this repo. Read in full before the first
change. Brain docs hold the detail; this file holds the rules that keep agents from
drifting away from them.

## Source of truth (tiebreaker)

- **This file is the canonical guide for every tool.** Cursor and Codex load it natively; Claude Code loads it through the one-line `@AGENTS.md` import in `CLAUDE.md`. Edit THIS file; never grow the shim.
- **Code is ground truth; this file is a verifiable pointer.** If a line here conflicts with the code, follow the CODE and fix or flag the stale line in the same session.

## Mission

SEO-first Next.js 16 App Router template with **next-intl SSR**, FSD layering,
split static + nonce CSP, Upstash-ready rate limiting, and a forkable scaffolding
pattern. This is a **template, not a shipped product** — several deps/files exist
as load-bearing examples, not dead code (see Danger Zones).

## Stack (pinned)

| Layer     | Choice                                                           |
| --------- | ---------------------------------------------------------------- |
| Runtime   | Node **≥ 24** (`engine-strict=true`)                             |
| Framework | Next.js **16** App Router (`build --webpack`, not Turbo)         |
| UI        | React **19**, Tailwind **v4**, shadcn-style `shared/ui/*`        |
| Lang      | TypeScript **6.0** strict                                        |
| State     | Zustand + `shared/lib/utils-store/createSelectors`               |
| Forms     | react-hook-form + Zod                                            |
| i18n      | **next-intl 4.13+** (SSR, `[locale]` segment, `messages/*.json`) |
| Tests     | Vitest + Testing Library (`test/`), Playwright (`e2e/`)          |
| Lint      | Oxlint → ESLint 10 (flat) → Prettier                             |

Detail: @.cursor/brain/PROJECT_CONTEXT.md

## Invariants (do not violate)

1. **Scope lock.** Change only what the task requires. No "while I'm here" edits,
   no opportunistic refactors, no new abstractions for single use sites. If the
   user asked for a bug fix, don't reorganize neighbours.
2. **One task = one commit.** Conventional Commits, **≤ 96 chars** on the subject
   line. No `Co-authored-by` tags. Never skip hooks (no `--no-verify`).
3. **The gate ladder.** `verify` (alias `verify:enterprise`) holds every OFFLINE
   check: lint → format → typecheck → **`test:coverage`** → build → **e2e**
   (Playwright vs `next start`). `verify:ci` adds the network-dependent
   `audit:gate` and is what husky **pre-push** and the CI `validate` job both run.
   `verify:full` adds `smoke:dev` and is the only local command that predicts the
   whole pipeline including the `dev-smoke` job. Zero-warnings
   (`eslint --max-warnings 0`, `oxlint --deny-warnings`).

    **`verify` is a strict superset of CI's offline checks**, so a green `verify`
    predicts a green `validate`. Keeping that true is a rule: **a new check goes
    into the script, never only into the workflow file.** The gate used to run
    `npm test` while CI ran `test:coverage`, so the thresholds in
    `vitest.config.ts` were defined but unenforceable locally.

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
9. **Explicit in/out contracts.** Components/hooks/handlers declare their output:
   a `FunctionComponent<Props>` annotation, an explicit return type
   (`(): ReactElement`), or for RSC/route entries `Promise<ReactElement>` /
   `Promise<NextResponse>` — enforced by
   `@typescript-eslint/explicit-function-return-type` (inline callbacks exempt).
   Interface callbacks use property style (`onSelect: (id: string) => void`) —
   enforced by `method-signature-style`.

## Commands (exact)

**Five agent commands** in `.claude/commands/`, mirrored by shims in
`.cursor/commands/` so Cursor and Claude Code behave identically:

```bash
/onboard   # get oriented: read the brain, VERIFY it against the code, report drift, stop
/feat      # implement a feature: reuse check -> scope -> plan -> test-first -> gate
/test      # write tests that hunt corner cases at integration seams, not the happy path
/review    # senior review of the diff: leaks, security (incl. proxy composition), bug hunt
/docs      # bring AGENTS.md + .cursor/brain/ back in line with the code and master's history
```

```bash
npm run dev                 # Turbopack dev (fast)
npm run dev:webpack         # webpack parity dev (debug splitChunks)
npm run build               # next build --webpack (production)
npm run build:analyze       # ANALYZE=true webpack build, opens bundle analyzer
npm run verify              # THE offline gate (alias of verify:enterprise)
npm run verify:enterprise   # lint → format → typecheck → test:coverage → build → e2e
npm run verify:ci           # verify + audit:gate — pre-push and the CI validate job
npm run verify:full         # verify:ci + smoke:dev — predicts the whole CI pipeline
npm run smoke:dev           # Turbopack dev smoke on its own (e2e/dev/, port 3003)
npm run fix                 # oxlint --fix → eslint --fix → prettier --write, repo-wide
npm run audit:gate          # fail-closed audit with a self-expiring allowlist
npm run test                # vitest run (the gate uses test:coverage — thresholds need --coverage)
npm run test:e2e            # Playwright (dev server locally unless CI=true)
npm run test:e2e:prod       # Playwright against `next start` (same as CI / verify gate)
npm run test:e2e:install    # one-time Chromium install for Playwright
npm run lint                # oxlint (--deny-warnings) → eslint (--max-warnings 0)
npm run typecheck           # tsc --noEmit (canonical; `type-check` is kept as an alias)
npm run test:mutation       # StrykerJS strength gate — weekly `mutation.yml` job, NOT in verify
```

**Bootstrap after clone**: `npm run prepare` (once) — `.npmrc` disables lifecycle
scripts as a supply-chain guard, so husky hooks don't install themselves; the
verify gate fails loudly if hooks are missing. Dependency cooldown is also on
(`.npmrc` `min-release-age=3`, DAYS): a brand-new package or urgent patch needs
`npm install <pkg> --min-release-age=0`.

`verify:enterprise` is authoritative. If it fails, fix the cause — do **not**
downgrade rules, silence warnings, or add `eslint-disable`. If a rule is wrong
for a real reason, raise it with the caller first.

**Complexity ratchet** — `complexity` 15 / `max-depth` 4 / `max-params` 6 /
`max-lines-per-function` 130 / `max-lines` 200 over `app`/`features`/`shared`/`i18n`,
tests exempt. Thresholds sit above the measured ceiling (see `DECISIONS.md`), so a
hit means new drift: split the function first; raising a number needs a fresh
measurement and a `DECISIONS.md` line.

**Mutation testing** — `npm run test:mutation` (StrykerJS, weekly `mutation.yml` CI
job). Coverage proves code RUNS under tests; the mutation score proves tests would
CATCH a wrong implementation (85% coverage floor vs 40.2% baseline score here, by
design). `thresholds.break` in `stryker.config.json` is a measured floor-of-record:
raise it after a good run, never lower it to go green. Scope mirrors the coverage
scope — `app/` stays out of both (measured: including it drops lines 93%→82%);
`app/` regressions are the e2e suite's job.

**The gate builds, and the production build requires `NEXT_PUBLIC_APP_URL`.** One
step, `cp .env.example .env.local`, after cloning. `next dev` needs nothing (the
schema defaults to localhost outside production), and CI injects
`https://template-next-seo.invalid` at the workflow level.
`scripts/check-build-env.mjs` runs before the build and says exactly that when the
value is missing or points at localhost — which `shared/lib/env.ts` rejects on
purpose. It loads `.env*` through `@next/env`, the same loader `next build` uses,
so it cannot report "not set" for a value the build would have found.

## Version holds (do not "fix" by bumping)

- **ESLint is 10.x** — the 9.x hold was lifted ahead of the 2026-08-06 end of
  life. Three plugins still cap their `eslint` peer below 10, so each has an
  `overrides` entry mapping that peer to `$eslint`; do not remove them and do not
  reach for `--legacy-peer-deps`. **`settings.react.version` must stay a literal,
  never `'detect'`** — see @.cursor/brain/DECISIONS.md.
- **TypeScript stays `~6.0.x`** — `typescript-eslint@8.65.0` peers
  `typescript >=4.8.4 <6.1.0`. Not a preference: a bump to 7.x makes **both**
  `npm install` and `npm ci` fail with ERESOLVE, so the tree stops resolving at
  all. That bump was merged once and reached master; `dependabot.yml` now ignores
  `typescript >=6.1` so it cannot happen again. Lift the hold only together with a
  `typescript-eslint` major that widens the peer.
- **`oxlint` tilde-tracks `eslint-plugin-oxlint`** — lockstep releases; the
  plugin pins `~<its version>`.
- **`@types/node` stays 24.x** — types match `engines.node >= 24`.
- **`overrides` in `package.json` are security floors WITH major caps**
  (`">=fixed <next-major"`). Two of our own uncapped floors (brace-expansion,
  fast-uri) aged into their advisories' vulnerable ranges and turned the audit
  gate red — an uncapped floor is a delayed regression. Do not remove a floor to
  quiet npm, and never write one without a cap; details in `DECISIONS.md`.

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

**Reuse first** — before creating any function/util/component/constant, search for
an existing equivalent and extend it. **Consistency beats preference** — match the
surrounding file's style and patterns.

**Content variance** — anything that renders authored copy is proven against content it has NOT seen:
`minimal` / `typical` / `long` / `unbroken` for text, `none` / `one` / `many` for collections. The fixture
is `/dev/ui/content-stress` (dev-only, 404 in production), measured by `e2e/dev/content-stress.spec.ts` at
390 / 640 / 768 / 1024 / 1440; the assembled pages are measured by `e2e/layout-geometry.spec.ts`. Add a
case when you add a content-bearing component, and keep a chrome LABEL separate from PROSE — feeding a
paragraph to a `whitespace-nowrap` button measures the wrong thing (568px of content in a 292px column
here, which reads as a broken primitive and is not one). Two rules earned the hard way: the RANGE of
widths a guard covers is part of its specification, and a wrap class with no red-to-green proof gets
deleted rather than kept "to be safe".

**Rendering differences are measured, not predicted** — engines disagree about intrinsic sizing, font
metrics (so any `ch` measure), scrollbar gutters and `forced-colors`. `CROSS_BROWSER=1` adds Firefox and
WebKit to the geometry specs; CI runs that as its own job. Never reason about what an engine does — run
it.

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
- **`next.config.ts` import graph is alias-free.** Next transpiles the config
  graph standalone, before any bundler `@/` alias exists — every file reachable
  from `next.config.ts` (e.g. `shared/lib/cspHeader.ts`) must use relative
  imports only. An alias import there fails the production build with
  `Cannot find module` at config load.
- **`proxy.ts`** — security-critical composition; see Security contract above.
- **`app/[locale]/*`** — every entry needs `setRequestLocale` before client
  descendants; missing calls swallow errors as `Error(void 0)` in prerender.
- **Template scaffolding** — `lucide-react`, `shared/constants/index.ts`,
  `features/example-form/**`, Web Vitals pipeline. These are load-bearing
  examples; the inline `// Template scaffolding` comments mark each site. Do
  not strip as "unused" unless the caller confirms "this is now my MVP".

Full list with risks + mitigations: @.cursor/brain/SKELETONS.md

## Machine-agnostic configs

Committed configs must never contain absolute local paths. The VS Code i18next
extension rewrites `i18next.i18nPaths` with absolute paths when it can't resolve
the configured ones — keep them relative and existing (here: `messages,i18n`).

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
- Weakening the verify gate, lint severities, or coverage thresholds to get
  green.

When unsure whether a change is in scope, state the intent and wait for
confirmation. Saying "I don't know" is preferable to guessing.

## Response discipline

- End any non-trivial implementation with a one-line
  `Confidence: HIGH | MEDIUM | LOW — reason`.
- Cite `path/to/file.ts:LINE` for code claims so the caller can verify.
- Prefer editing existing files over creating new ones.
- Never write emojis unless asked.

## Maintaining this file

Treat it like code. Add a rule when an agent or developer makes the same mistake
twice — one line tied to the observed failure. Prune stale lines; a bloated file
reduces compliance. One-line digests only — depth lives in `.cursor/brain/`.
