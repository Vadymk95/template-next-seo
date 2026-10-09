# DECISIONS — template-next-seo

Why things are the way they are, one entry per decision. History lives in `git log -p -- .cursor/brain/DECISIONS.md` and the linked PRs: a wrong, superseded or dead decision is deleted from here, not archived. An entry stays under 30 lines (context, decision, consequences, status, evidence link); a decision a guard enforces names the guard and is stated once. The law itself is in `AGENTS.md`.

| Decision | Date | Status |
| --- | --- | --- |
| Dependencies: newest compatible, a hold only for a measured incompatibility | 2026-10 | in force |
| `agentRules: false` keeps `next dev` out of `AGENTS.md` | 2026-10 | in force |
| Footer year is read once at module load | 2026-10 | in force |
| Doc pointers are backticked paths, never `@` imports | 2026-10 | in force |
| Runtime axe scan inside the existing page specs | 2026-10 | in force |
| Playwright `failOnFlakyTests` in CI | 2026-10 | in force |
| zizmor audits the workflows in `security.yml` | 2026-10 | in force |
| First-load JS budget: `size:check`, right after `build`, full phase only | 2026-10 | in force |
| Every GitHub Action is SHA-pinned; workflow tokens default to read-only | 2026-10 | in force |
| Guards born of the 2026-10 audits | 2026-10 | in force |
| Playwright `maxFailures: 10` on the gate run and in CI | 2026-10 | in force |
| Docs: ADR-lite, one canonical place per fact, an always-on core of Cursor rules | 2026-10 | in force |
| Agent limits in a committed `.claude/settings.json` | 2026-09 | in force |
| CI plumbing: one Dependabot group, release token optional | 2026-09 | in force |
| vitest is held at 4.1.x because the Stryker runner kills nothing under vitest 5 | 2026-09 | in force |
| Content variance is measured in a browser, not asserted in jsdom | 2026-08 | in force |
| The 44 px touch floor is a ratchet, not a redesign | 2026-08 | in force |
| `outline-hidden`, never `outline-none` | 2026-08 | in force |
| Tailwind class lint: two rules adopted, `no-unknown-classes` refused | 2026-08 | in force |
| Gate hygiene: no fail-open shape, no second list | 2026-08 | in force |
| Cross-engine coverage is opt-in and scoped | 2026-08 | in force |
| Complexity ratchet: thresholds above the measured ceiling, production code only | 2026-08 | in force |
| Mutation testing is a weekly strength gate, outside `verify` | 2026-08 | in force |
| The gate ladder: `verify` is a subset of `verify:ci`, which is a subset of `verify:full` | 2026-07 | in force |
| Advisory exceptions are data; an allowance is the last resort | 2026-07 | in force |
| The gate runs from a clean clone: `check-build-env` | 2026-07 | in force |
| ESLint 10, with `$eslint` overrides and a literal `settings.react.version` | 2026-07 | in force |
| `no-magic-numbers` ignores HTTP status codes | 2026-07 | in force |
| Constants only for a second call site or an external contract | 2026-05 | in force |
| External data is parsed at the boundary with Zod | 2026-05 | in force |
| Content Security Policy: nonce on dynamic routes, `'unsafe-inline'` on ISR routes | 2026-05 | in force |
| `web-vitals` is an explicit dependency next to `next/web-vitals` | 2026-05 | in force |
| Rejected, and the event that reopens each | 2026-05 | in force |
| ESLint and Oxlint are layered, and the type-aware presets sit after the Oxlint block | 2026-04 | in force |
| i18n is next-intl SSR with a `[locale]` segment | 2026-04 | in force |
| Rate limiting runs in `proxy.ts`; the limiter core is Edge-safe | 2026-04 | in force |
| Build and styling basics: webpack build, Tailwind v4, lockfile root, named vendor chunks | 2026-03 | in force |

## Dependencies: newest compatible, a hold only for a measured incompatibility

2026-10 · in force · guard `scripts/check-version-holds.mjs` · evidence: PR #100, `scripts/version-holds.json`

- **Context:** a version pinned "to be safe" is a decision nobody re-reads; the holds had drifted between prose,
  `dependabot.yml` and the lockfile, and nothing stopped an agent bumping a held package.
- **Decision:** every package goes to its newest compatible stable release. A version is held only for an
  incompatibility someone measured; the hold is one entry in `scripts/version-holds.json` (range, reason, lift
  condition, evidence) plus a matching Dependabot `ignore`. `AGENTS.md` carries one line per hold and points there.
  `.npmrc` keeps `min-release-age=3`; skipping that cooldown is a per-instance operator call, never a default.
- **Consequences:** a lockfile or manifest outside a held range, a hold without its Dependabot ignore, or a hold on
  an absent package fails `verify`. A hold is lifted by the event named in its `lift` field, in one commit with
  its Dependabot ignore.
- **Status:** in force. The audit allowance for `braces` lives in `scripts/audit-allowlist.json`, which expires on its own.

## `agentRules: false` keeps `next dev` out of `AGENTS.md`

2026-10 · in force · guard `next.config.test.ts` · evidence: PR #100, `next.config.ts:34`

- **Context:** Next 16.4 `next dev` writes a managed `nextjs-agent-rules` block into `AGENTS.md` whenever it
  detects a coding agent and the block is missing. `AGENTS.md` is this repo's own law and must not drift under a
  dev server (measured: 10 added lines on 16.3.8 with the default, byte-identical with `false`).
- **Decision:** `agentRules: false` in `next.config.ts`. The one useful line of that block, where the
  version-matched Next docs live (`node_modules/next/dist/docs/`), is written by hand under `AGENTS.md` § Stack.
- **Consequences:** none at runtime. The option is documented in the installed Next at
  `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/agentRules.md`.
- **Status:** in force.

## Footer year is read once at module load

2026-10 · in force · evidence: PR #100, `shared/ui/common/Footer/index.tsx:10`

- **Context:** oxlint 1.86 `react/purity` flagged `new Date().getFullYear()` called during render and turned
  `oxlint --deny-warnings` red.
- **Decision:** `CURRENT_YEAR` is a module constant. The rule is not silenced: weakening a lint severity to get
  green is out of scope for this template.
- **Consequences:** on a long-lived server the year changes at the next restart or build, not on 1 January.
  Prerendered pages already carry the build-time year.
- **Status:** in force.

## Doc pointers are backticked paths, never `@` imports

2026-10 · in force · guard `docs:check` (`memoryImports`) · evidence: PR #98, PR #99

- **Context:** Claude Code expands a bare `@path` outside a code span as a recursive memory import, and
  `CLAUDE.md` is `@AGENTS.md`. Every session loaded eight files (about 158 KB) before the first prompt, and two
  subagents died of autocompact thrashing.
- **Decision:** every pointer to a file is a code span. The only import is the `@AGENTS.md` line in `CLAUDE.md`;
  the brain files are read on demand.
- **Consequences:** the load closure is `CLAUDE.md` + `AGENTS.md`. `docs:check` refuses an agent-memory import
  anywhere else in either file.
- **Status:** in force.

## Runtime axe scan inside the existing page specs

2026-10 · in force · evidence: PR #97, `e2e/support/a11y.ts`

- **Context:** the static `jsx-a11y` rules read JSX and cannot see what the browser composes from it (contrast,
  a landmark rendered twice, a swallowed label, a target under 24 px). The template had no check at that layer.
- **Decision:** `expectNoSevereA11yViolations(page)` runs `@axe-core/playwright` with `target-size` (WCAG 2.2
  SC 2.5.8, off by default in axe) switched on, failing on `serious` and `critical`. It is called after the
  readiness assertion of the specs that already load the public routes: `e2e/smoke.spec.ts`,
  `e2e/example-form.spec.ts` and, for the not-found route, `e2e/layout-geometry.spec.ts` (once, first width).
  No `test()` block was added, so the suite ceiling in `scripts/gate-tiers.json` does not move.
- **Consequences:** moderate and minor findings are advice that needs a design position a template does not
  have, so they do not fail. There is no allow-list: a rule that cannot hold for a template is recorded here.
  A scan before the page rendered passes by measuring nothing, hence the call sits after readiness.
- **Status:** in force.

## Playwright `failOnFlakyTests` in CI

2026-10 · in force · guard `scripts/check-playwright-gate-config.test.mjs` · evidence: PR #97

- **Context:** with `retries: 2` a test that fails then passes was green, the failure visible only in the report.
- **Decision:** `playwright.config.ts` and `playwright.dev.config.ts` set `failOnFlakyTests: isCI`. A real flake
  is fixed or quarantined with a written reason.
- **Consequences:** preventive here: the last CI logs showed no flaky marker; the flake that motivated it was
  seen in `template-spa-pwa`.
- **Status:** in force.

## zizmor audits the workflows in `security.yml`

2026-10 · in force · guard required check `Workflow audit (zizmor)` in `.github/ruleset.json` · evidence: PR #97

- **Context:** five workflow files outgrew the 2026-07 "only if workflows grow" trigger for a workflow audit.
- **Decision:** a `zizmor` job in `security.yml` runs the SHA-pinned `zizmorcore/zizmor-action` over
  `.github/workflows` with `.github/zizmor.yml` and `min-severity: medium`; the same file backs the local
  command `uvx zizmor@<pinned version> .github/workflows`. No SARIF upload, so it works without code scanning.
- **Consequences:**
  - Online and offline runs grade differently: online, a checkout without `persist-credentials: false` is Low;
    offline it is Medium. `artipacked` is therefore remapped to medium in `.github/zizmor.yml`, so both runs fail
    on it. Every checkout that does not push sets `persist-credentials: false`.
  - `adhoc-packages` is ignored for `ci.yml` as a whole file: the three `npm install -g npm@^11.14.0` steps are
    deliberate and npm cannot be pinned through `package.json`.
  - A new required check goes into the live ruleset only after the job has reported once.
- **Status:** in force. The `auditor` and `pedantic` personas are outside the default persona and not addressed.

## First-load JS budget: `size:check`, right after `build`, full phase only

2026-10 · in force · guard `scripts/check-bundle-budget.mjs` · evidence: PR #96, `scripts/bundle-budget.json`

- **Context:** nothing bounded the JavaScript a first visit downloads; a heavy import could land unnoticed.
- **Decision:** `npm run size:check` fails when the brotli size of the shared first-load JS, or of the heaviest
  PUBLIC route, passes a limit in `scripts/bundle-budget.json`. It sits right after `build` in
  `verify:enterprise:inner`, so it runs in the full phase and is printed as skipped at phase 0.
- **What is measured:** from the manifests the build leaves (Next 16 prints no table): shared = JS in
  `.next/build-manifest.json` `rootMainFiles`; a route = shared plus its own chunks from `clientModules[*].chunks`
  of its client-reference manifest (`entryJSFiles` is empty under `--webpack`), each file once; brotli default
  quality, 1 KB = 1024 bytes. Public routes come from `.next/app-path-routes-manifest.json` minus `excludeRoutes`,
  so a route a fork adds is inside the budget until someone excludes it on purpose. It fails closed on a missing
  manifest, a missing chunk, no public route or a malformed budget.
- **Baseline (master `ab50035`):** shared 121.18 KB, heaviest route `/[locale]/example-form` 184.43 KB; each limit
  is the measurement + at most 10%, rounded up (134 and 203).
- **Moving a limit:** re-measure on a build, put the number, the build and the date in the commit message, and
  keep the limit at measurement + at most 10%. A number raised to turn a red run green is the failure this gate
  exists to catch. Not covered: `/dev/*`, CSS, images, fonts, lazily loaded chunks.
- **Status:** in force.

## Every GitHub Action is SHA-pinned; workflow tokens default to read-only

2026-10 · in force · guard Dependabot `github-actions` keeps pins current · evidence: PR #93, `.github/workflows/`

- **Context:** a floating `@vN` tag stays movable by its publisher (or whoever takes the account over), and the
  next run executes the new code with our token. Only a commit SHA cannot be moved.
- **Decision:** every `uses:` is a full 40-hex SHA with the resolved version as a trailing comment.
  `release.yml` and `security.yml` declare `permissions: contents: read` at the top; a job that writes
  (`release-please`) gets its own scopes, so a job added later starts read-only.
- **Consequences:** Dependabot updates the SHA and its version comment together.
- **Status:** in force.

## Guards born of the 2026-10 audits

2026-10 · in force · evidence: PR #93, PR #95, PR #96; each guard is the named file

- **Context:** audit rounds reproduced silent holes; each is closed at the cheapest static or unit layer.
- **Decision and guards:**
  - A page under `app/[locale]/**` missing from `app/sitemap.ts`: `app/sitemap.test.ts` walks the pages.
  - `RATE_LIMIT_TRUST_PROXY=first-hop` trusts a spoofable header: a one-time production warning in
    `emitModeWarningOnce` (`shared/lib/middlewareRequest.ts`), covered by its unit test.
  - `scrollbar-gutter: stable` regression: asserted per width in `e2e/layout-geometry.spec.ts`.
  - `catch {}` passed every check: `no-empty` with `allowEmptyCatch: false` in `eslint.config.js`.
  - Pre-commit missed the checker's own files: `.husky/pre-commit` triggers `docs:check` on
    `scripts/docs-check.*` and `package.json` too.
  - A CI `run:` step outside the gate (the 2026-07 "gate lied" class): `docs:check` `ciSteps` against
    `ci.allowedRunSteps` in `scripts/gate-tiers.json`, read per line, block scalars included.
  - A required ruleset context no job produces: `docs:check` `rulesetContexts` against `.github/ruleset.json`; a
    context GitHub renders only at runtime prints one loud non-failing line.
- **Status:** in force. `scripts/docs-check.mjs` is a shared file, byte-identical across the four templates.

## Playwright `maxFailures: 10` on the gate run and in CI

2026-10 · in force · guard `scripts/check-playwright-gate-config.test.mjs` · evidence: commit `3bdfc64`

- **Context:** measured in a product forked from this template: 22 of 60 pushes went red and a red push ran up
  to 21 minutes against about 5 for a green one, because every failing test waited out its own timeout.
- **Decision:** `playwright.config.ts` caps `maxFailures` at 10 when `isCI || isProdServer`; the desk run against
  `next dev` stays uncapped. Each config writes its own `outputDir` (`test-results/e2e`, `test-results/dev`) so
  `--last-failed` never reads the wrong suite's record. 10 beat 5 on one measured break (21 s vs 15 s, twice the
  failing neighbours reported).
- **Consequences:** the cap can stop short of tests it never reached; the push re-runs the whole gate.
- **Status:** in force.

## Docs: ADR-lite, one canonical place per fact, an always-on core of Cursor rules

2026-10 · in force · guard `docs:check`, `scripts/check-version-holds.mjs` · evidence: `AGENTS.md` § Pull requests, brain docs, replies

- **Context:** `AGENTS.md` had grown to 457 lines, this file to 1048, and the mandatory read to about 75 KB; facts
  were restated across files, revisit dates sat in prose where a keyword check read them as deadlines, and nothing
  stopped an agent bumping a held package.
- **Decision:** entries here stay under 30 lines (context, decision, consequences, status, evidence link);
  a superseded or wrong decision is deleted, not archived, and history lives in `git log -p` and the linked PRs.
  `AGENTS.md` holds rules and pointers (versions in `package.json`, commands in the `README.md` table), one line
  per hold. Revisits are events (an upstream release, a Dependabot PR), not calendar dates; only structured files
  carry dates. Only the `alwaysApply` core of `.cursor/rules` loads on every Cursor turn; the rest load by glob.
- **Consequences:** `docs:check` has no prose-date rule and `check-version-holds` fails on a held package outside
  its range. A fork starts its own decisions file: `README.md` § What your fork does not inherit.
- **Status:** in force.

## Agent limits in a committed `.claude/settings.json`

2026-09 · in force · evidence: commit `c32df99`, `.claude/settings.json`, `AGENTS.md` § Lanes

- **Context:** reopened 2026-09-28 by the owner: the earlier review had deferred it until an agent edited a
  listed file, and public guides now name a deny list as the baseline of an agent setup.
- **Decision:** the file is tracked. It denies in every permission mode (bypass included): reading `.env` files
  other than the example, editing itself, force pushes, `--no-verify`, `git reset --hard`, `git clean -f`. It
  asks before edits of the gate files and of `next.config.ts` and `proxy.ts`. The rule text is in `AGENTS.md`.
- **Consequences:** it is not a security boundary: a rule matches the command as written, so `sh -c`, a full
  binary path or a `git -C` prefix walks past it, and `-uf` or a trailing `-n` still get through (more wildcards
  would catch commit messages). The boundary is the required CI check. Cursor and Codex do not read the file.
- **Status:** in force. Two adversarial passes found `+branch` and `-fu` pushes; `git push -f*`, `git push *+*`
  and `git commit -n*` replaced the space-anchored forms.

## CI plumbing: one Dependabot group, release token optional

2026-09 · in force · evidence: commits `9d1aeef`, `a05de4b`

- **Decision:** one `minor-and-patch` Dependabot group carries every non-major update (a major still opens its
  own PR): two groups both rewrote `package-lock.json`, so the second PR conflicted after the first merged.
  `release.yml` passes `secrets.RELEASE_PLEASE_TOKEN || github.token`.
- **Consequences:** with the secret absent, release PR runs wait in `action_required` for one approval; with a
  fine-grained PAT in it, release PRs get CI like any other PR.
- **Status:** in force.

## vitest is held at 4.1.x because the Stryker runner kills nothing under vitest 5

2026-09 · in force · guard `scripts/version-holds.json` · evidence: commits `4e8221c`, `48f68a5`

- **Context:** vitest 5.0.0 plus `@stryker-mutator/vitest-runner` 10.0.0 (2026-08-14, older than vitest 5) runs
  zero tests per mutant: the one-file probe `stryker run --mutate shared/lib/rateLimitCore.ts` kills 0 of 48, and
  the full run scored 2.94% against a 40.24% baseline. Under vitest 4.1.11 the same probe kills 37 of 48.
  Stryker 9.6.1, `coverageAnalysis` and the alias change were ruled out. The sibling Vite templates hit the same
  from 2026-09-14 and returned to 4.1.x on 2026-10-02. Not root-caused further.
- **Decision:** `vitest` and `@vitest/coverage-v8` stay `^4.1.11`; `dependabot.yml` ignores `>=5`. A strength
  gate that cannot fail is worse than a runner one major behind: the weekly job would go red every run and teach
  everyone to ignore it.
- **Lift:** a vitest-runner release dated after 2026-09-03, then `npm install -D vitest@5 @vitest/coverage-v8@5`
  and the probe above; take vitest 5 when it kills mutants, in the commit that drops the Dependabot ignore.
- **Consequences:** the fixes made for vitest 5 stay (they hold on 4.1): `vi.stubGlobal` in
  `scripts/probe.test.mjs`, glob-form `coverage.exclude` (a bare `'app/'` stopped matching as a prefix), and
  `import.meta.dirname` for the `@` alias. jsdom 30 needs Node `^24.15.0`. `.stryker-tmp` sits in `.gitignore`,
  `.prettierignore` and ESLint `globalIgnores`: a crashed run left a sandbox copy that reddened lint.
- **Status:** in force; mutation floor `thresholds.break` 35, measured 40.24.

## Content variance is measured in a browser, not asserted in jsdom

2026-08 · in force · guard `e2e/dev/content-stress.spec.ts`, `e2e/layout-geometry.spec.ts` · evidence: `e2e/support/geometry.ts`

- **Context:** jsdom has no layout, so a unit test can only pin a class string. The first run found defects the unit
  suite could not see: 172 px of overflow from a 40-character unbroken token at 390, a button row 1161 px wide in a
  798 px container at 1440, and 28 px of horizontal document scroll from the header on every route at 390.
- **Decision:** each content-bearing primitive renders once per content state on the dev-only route
  `/dev/ui/content-stress`, and Playwright measures it at 390, 640, 768, 1024 and 1440. The invariants are pure
  predicates in `e2e/support/geometry.ts`, shared with `e2e/layout-geometry.spec.ts`, which measures the assembled
  pages: one definition, two consumers. Text states are `minimal` (one character), `typical`, `long`, `unbroken`
  (the load-bearing one: a sentence wraps on its spaces and hides a missing wrap guard); collections are `none`,
  `one`, `many`. No RTL state, because no RTL locale ships.
- **Consequences:** counts are derived, never literal: the fixture publishes `data-stress-total` and
  `data-stress-components` and the spec compares what it found against them, with a floor and a named state set.
  The fixture is unreachable from `next start`, so it runs under `verify:full` and the mandatory `dev-smoke` CI job;
  `playwright.config.ts` keeps `dev/**` in `testIgnore`, or the production project reports a pass on a 404.
- **Status:** in force.

## The 44 px touch floor is a ratchet, not a redesign

2026-08 · in force · guard `e2e/support/control-targets.ts`, `control-targets.test.ts` · evidence: same files

- **Context:** exactly two rendered sizes sit below 44 across all routes and content states: 40 (`Button`, from
  `h-10` and `size-10`) and 36 (`Input`, from `h-9`). Both are shadcn's default scale, shipped unaltered.
- **Decision:** the gate accepts those two EXACT sizes, each with a reason and an exit condition; any other size
  below the floor fails. Raising the kit to 44 would change the visual scale of every app scaffolded here, which is
  the consuming app's design decision.
- **Consequences:** an acceptance list fails by wrongly accepting, and sabotage never points that way, so the unit
  test is all near-misses: 37, 38, 39, 41 and 42 refused, an icon-only control refused at an accepted height but a
  narrow width.
- **Status:** in force.

## `outline-hidden`, never `outline-none`

2026-08 · in force · guard `e2e/forced-colors.spec.ts` · evidence: `shared/ui/button.tsx`, `shared/ui/input.tsx`

- **Context:** compiled from the installed Tailwind: `.outline-hidden` emits `outline-style: none` plus a
  `forced-colors: active` transparent outline; `.outline-none` emits only the first. Controls here pair the reset
  with a `ring-*` (a `box-shadow`), and forced-colors mode suppresses box shadows, so a Windows high-contrast user
  had no focus indicator (WCAG 2.4.7).
- **Decision:** `outline-hidden` everywhere; the committed browser test emulates forced colors. Restoring
  `outline-none` makes it report `outline=none shadow=none`.
- **Consequences:** `better-tailwindcss/no-deprecated-classes` does not help: both classes are valid and not
  deprecated. The build emits no warning, so on every Tailwind minor bump read the release notes for renamed
  utilities; this one test is the only guard.
- **Button ring offset:** the `Button` base variant omits `ring-offset-background` (`shared/ui/button.tsx:10`); the
  focus ring comes from `ring-*` and `ring-offset-2` alone, matching the sibling enterprise template. Nothing
  guards it: do not re-add the shadcn default.
- **Status:** in force.

## Tailwind class lint: two rules adopted, `no-unknown-classes` refused

2026-08 · in force · guard `better-tailwindcss` rules in `eslint.config.js:393` · evidence: same file

- **Context:** a pre-flight found `no-deprecated-classes` 2 findings, both genuine, `enforce-canonical-classes` 0,
  `no-unknown-classes` 0.
- **Decision:** the first two are `error`. `no-unknown-classes` stays off despite zero findings: in a template its
  failure mode is a false positive on the first hand-written CSS class a fork adds, and `i18n-loading` is applied
  imperatively where the rule cannot see it.
- **Consequences:** zero findings today is no evidence it is safe for what gets scaffolded later.
- **Status:** in force.

## Gate hygiene: no fail-open shape, no second list

2026-08 · in force · guard `scripts/check-coverage.mjs`, `scripts/bench-verify.mjs`, `scripts/ensure-playwright.mjs` · evidence: their tests

- **Coverage dropout:** with an unparseable file in the coverage scope, vitest prints `Failed to parse <file>.
  Excluding it from coverage.` and exits 0, so the percentage describes a smaller set. `check-coverage.mjs` refuses
  on that marker, proven both ways. It is marker-based on purpose: a file-count baseline in a template records the
  count of an empty scaffold.
- **`bench:verify` drifted** from the gate it claimed to mirror (no `check-hooks`, no `ensure-playwright`). Its step
  list is now derived from the `verify` script and throws on a segment it cannot parse: a second list claiming the
  gate's scope always drifts narrower.
- **`npx` needs `--no-install`** in `ensure-playwright.mjs`: with an incomplete `node_modules` it fetches the newest
  Playwright and installs browsers for a version this repo does not pin.
- **Test budgets follow what the test does:** the `verify-push` CLI cases boot node, npm and node, took seconds
  under a busy worker pool, and timed out at vitest's 5 s default. The describe block carries a 20 s budget
  (`scripts/verify-push.test.mjs:113`). A `skip` was rejected: those cases prove phase routing and exit-code
  passthrough, the thing a silent pass would hide.
- **Status:** in force.

## Cross-engine coverage is opt-in and scoped

2026-08 · in force · guard `scripts/check-cross-browser-selection.mjs` · evidence: `e2e/support/cross-browser.ts`

- **Context:** three engines on every spec triple the local e2e wall-clock, and a WebKit font-metric difference in
  an unrelated spec would fail a push for a reason unrelated to the change.
- **Decision:** `CROSS_BROWSER=1` adds Firefox and WebKit projects, `testMatch`-scoped to the geometry specs. The
  first run found a rule defect no reasoning had: Firefox reports `clientWidth: 0` for an inline `<label>`
  (CSSOM gives non-replaced inline elements a zero client box), so every label read as 176 px of overflow in one
  engine. The rule now exempts exactly `display: inline`, tested both ways.
- **Consequences:** a `testMatch` that matches nothing collects zero tests and reports success, so the selection
  check asks Playwright whether every configured project has work and fails closed on a report it cannot read.
- **Status:** in force.

## Complexity ratchet: thresholds above the measured ceiling, production code only

2026-08 · in force · guard five ESLint core rules in `eslint.config.js:421` · evidence: the measured table at `eslint.config.js:401`

- **Decision:** `complexity` 15, `max-depth` 4, `max-params` 6, `max-lines-per-function` 130, `max-lines` 200 gate
  `app`, `features`, `shared` and `i18n`. The thresholds sit above the measured ceiling (12 / 3 / 5 / 102 / 143),
  so the gate is clean on day one and fires only on drift. Tests and `shared/lib/test-utils` are exempt on
  purpose: a `describe` block is one function to these rules, and table-driven suites are long by design.
- **Consequences:** when a threshold fires, split the function. Raising a number needs a fresh measurement in the
  commit message.
- **Status:** in force.

## Mutation testing is a weekly strength gate, outside `verify`

2026-08 · in force · guard `stryker.config.json` `thresholds.break: 35`, `.github/workflows/mutation.yml` · evidence: `stryker.config.json`

- **Context:** coverage cannot say whether tests would CATCH a wrong implementation. The baseline run scored
  40.21% (228 of 567 mutants killed, 194 in code no test covers) against a green 85% coverage floor; the latest
  run on Stryker 10.0.0 with vitest 4.1.11 scored 40.24%.
- **Decision:** `npm run test:mutation` runs weekly (cron and dispatch), not in `verify`: a full run costs 2m28s
  locally and more on CI. The floor of 35 is a floor of record: raise it after a good run, never lower it to
  go green. The scope mirrors coverage (`features`, `shared`, `i18n`); `app/` is out of both, so route handlers
  and Server Actions are invisible to this score and the Playwright suite covers them.
- **Consequences:** the score measures only the kill side; an over-strict test that rejects a legitimate
  implementation is for review. `.stryker-tmp` and `reports` are gitignored and `.env*` is in `ignorePatterns`
  (Stryker does not read `.gitignore`). The runner's tree is in the fail-closed audit; a high advisory there gets
  an override floor with a major cap, not an allowlist entry. Why vitest is held: its own entry above.
- **Status:** in force.

## The gate ladder: `verify` is a subset of `verify:ci`, which is a subset of `verify:full`

2026-07 · in force · guard `scripts/gate-tiers.json`, `bench:verify` · evidence: `AGENTS.md` § The tier law

- **Context:** `verify:enterprise` ran `npm test` without `--coverage`, so the thresholds in `vitest.config.ts`
  were unenforceable locally while CI enforced them; CI also ran an audit that existed nowhere locally.
- **Decision:** `verify` holds every offline check; `verify:ci` adds `audit:gate` (network) and predicts the
  `validate` job; `verify:full` adds `smoke:dev`. Which moment runs which is in the tier law, not here.
  `smoke:dev` stays out of the push: a cold Turbopack boot costs 10-30 s, so it is its own mandatory parallel CI
  job. `playwright.config.ts` keeps `testIgnore: 'dev/**'`, or the production project runs the Turbopack smoke
  against `next start`, where it can pass and make the coverage an illusion.
- **Consequences:** `verify` is slower (coverage instead of a bare pass). Pre-commit is repo-scoped (TDD sibling
  gate, repo-wide oxlint and format check) because lint-staged restores unstaged hunks after fixing.
- **Status:** in force. Revisit when a PR goes red on `dev-smoke` twice in one month: then move `smoke:dev`
  into `verify:ci`.

## Advisory exceptions are data; an allowance is the last resort

2026-07 · in force · guard `audit:gate`, `scripts/audit-allowlist.json` · evidence: commit `9cf441c`

- **Context:** a high advisory on `brace-expansion` was allowlisted on the belief nothing could be bumped; true of
  the direct dependencies, wrong of the transitive one. npm's `fixAvailable` suggested a major downgrade of a lint
  plugin.
- **Decision:** `audit:gate` fails on every high or critical advisory, an expired allowance, an allowance whose
  advisory vanished, and its own inability to finish. Lowering a threshold is not available; a written reason with
  an expiry is. Read the advisory's fixed range, not `fixAvailable`. Removing an allowance and adding its override
  are one commit: the stale check fails the gate the moment the override lands.
- **Consequences:** security floors in `package.json` `overrides` are written `">=fixed <next-major"`, never
  uncapped (an uncapped one aged into its own advisory's vulnerable range). Do not remove a floor to quiet npm.
- **Status:** in force; the allowlist was empty at this entry.

## The gate runs from a clean clone: `check-build-env`

2026-07 · in force · guard `scripts/check-build-env.mjs` · evidence: `README.md` § Environment Variables

- **Context:** the production build requires `NEXT_PUBLIC_APP_URL`, and `.env.example` once suggested
  `http://localhost:3000`, which `shared/lib/env.ts` rejects in production, so the repo's own instructions gave a
  red gate with a Zod trace and no hint.
- **Decision:** `.env.example` carries the reserved `.invalid` placeholder; `scripts/check-build-env.mjs` runs
  before the build and prints the one-line remedy. It loads `.env*` through `@next/env`, the loader `next build`
  uses (Node alone would report "not set" for a value in `.env.local`), so `@next/env` is an explicit
  devDependency whose pin matches `next`; it is CommonJS, so the default import is destructured.
- **Consequences:** the production check is unchanged; cloning needs one copy-the-example step next to
  `npm run prepare`.
- **Status:** in force.

## ESLint 10, with `$eslint` overrides and a literal `settings.react.version`

2026-07 · in force · guard `eslint.config.js` (trailing settings block) · evidence: `eslint.config.js:432`, `package.json` `overrides`

- **Context:** the 9.x line ends its support on 2026-08-06, and `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and
  the transitive `eslint-plugin-import` still cap `eslint` at `^9` in their peers.
- **Decision:** ESLint 10 with three `overrides` entries mapping those plugins' `eslint` to `$eslint`. `npm install`
  and `npm ci` both pass without `--legacy-peer-deps`, which a hardened `.npmrc` rules out as a permanent posture.
  `settings.react.version` is `'19.2'`, never `'detect'`: `eslint-plugin-react` resolves `'detect'` through
  `context.getFilename()`, which ESLint 10 removed. `eslint-config-next` sets `'detect'` for its own patterns, so
  pinning only our block is not enough: a trailing config object with no `files` key repeats the pin and wins.
- **Consequences:** an install that fails on these peers is the signal to re-check the override, not to add a flag.
  A config that lints nothing looks like a clean run, so it was checked once to be live: 57 rules active, 9 plugins
  loaded on a real source file. Hold and lift: `scripts/version-holds.json` (`eslint`, `@eslint/js`).
- **Status:** in force.

## `no-magic-numbers` ignores HTTP status codes

2026-07 · in force · guard `@typescript-eslint/no-magic-numbers` in `eslint.config.js:175` · evidence: same file

- **Context:** enabling the rule gave 54 findings, mostly `{ status: 404 }` in route handlers and Next's own
  `images.deviceSizes` table. A status code is a universal table and self-documenting at the use site.
- **Decision:** the rule blocks the gate. It ignores -1, 0, 1, 2, the units 60, 100 and 1000, and a listed set of
  HTTP status codes; `*.config.{ts,js,mjs}` and test files are exempt. Naming twenty status codes would move an
  HTTP table into our vocabulary and buy nothing.
- **Consequences:** five real values survived and were named, because the bare number hid intent: the CSP report
  field truncation, the nonce byte length, the rate-limit key prefix that reaches a log line, and the user-agent
  slice in the anonymous rate-limit key (it bounds bucket cardinality against a spoofed user agent).
- **Status:** in force.

## Constants only for a second call site or an external contract

2026-05 · in force · guard `@typescript-eslint/no-magic-numbers`; `.cursor/rules/constants.mdc` · evidence: `shared/constants/index.ts`

- **Context:** this template has little string duplication. The only strings that must stay in lock-step across
  files are the CSP `Reporting-Endpoints` name and the `/api/csp-report` path; drift silently drops violation reports.
- **Decision:** `CSP_REPORTING_ENDPOINT_NAME` and `API_PATHS` live in `shared/constants/` (`next.config.ts` and
  `shared/lib/cspHeader.ts` read them). Extract a string or number only with 2+ call sites or an external contract;
  single-use, self-documenting values, i18n keys and the scaffold's seed examples stay inline. Constants are
  `as const` objects, never `enum`.
- **Consequences:** a fork that deletes more than half the constants in its first product slice is the signal that
  the pattern does not fit its flow.
- **Status:** in force.

## External data is parsed at the boundary with Zod

2026-05 · in force · guard `.cursor/rules/resilience.mdc` · evidence: `shared/lib/api/safeFetch.ts`, `app/actions/example-form.ts`

- **Context:** `await fetch()` in a Server Component returns an untyped `Response`, a Server Action returns an
  unchecked shape to the client, and `request.json()` is `unknown`.
- **Decision:** route-handler input and output, Server Action input (`formData` schema) and output (a result
  schema), and RSC `fetch()` calls (through `safeFetch(url, schema)`) are parsed with Zod. Reference
  implementation: `app/actions/example-form.ts`. Not for trusted same-process calls or throwaway prototypes.
- **Consequences:** no bundle cost (Zod is already a dependency), about 50-200 microseconds per parse, and
  schemas that duplicate back-end types, which is acceptable for a small team.
- **Status:** in force. Opt-in per boundary for a fork.

## Content Security Policy: nonce on dynamic routes, `'unsafe-inline'` on ISR routes

2026-05 · in force · guard `proxy.test.ts`, `next.config.test.ts` · evidence: `proxy.ts:109`, `shared/lib/cspHeader.ts`

- **Context:** Next 16 emits inline `self.__next_f.push(...)` scripts into prerendered HTML at build time. A cached
  ISR page cannot carry a per-request nonce ("Nonces only support dynamic routes" in the Next CSP guide), and a hash
  list is impractical because the payload differs per page.
- **Decision:** two policies. ISR and static document routes get `script-src 'self' 'unsafe-inline'` from
  `next.config.ts` `headers()` (`buildStaticContentSecurityPolicy`), together with HSTS in production, frame options,
  COOP/CORP, Permissions-Policy and `Reporting-Endpoints` pointing at `/api/csp-report`. `/api/*` and `/dev/*` get
  `script-src 'strict-dynamic' 'nonce-<random>'` from `proxy.ts` (`buildContentSecurityPolicy`), with the nonce
  forwarded in `x-nonce`. The rest of the static policy bounds the ISR surface: `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`, `connect-src 'self'`, `form-action 'self'`.
- **Rejected:** a nonce on document routes. Tried through `intlMiddleware`: the production HTML had 0
  `<script nonce>` attributes, the header announced a nonce nothing matched, all 8 inline scripts were blocked and
  hydration broke.
- **Consequences:** `'unsafe-inline'` weakens the ISR surface. The prerendered HTML carries no user input in inline
  scripts by design; a fork that puts user-generated content into an ISR route must escape strictly or move that
  route to a dynamic one with the nonce policy. `X-XSS-Protection` is omitted (deprecated).
- **Status:** in force.

## `web-vitals` is an explicit dependency next to `next/web-vitals`

2026-05 · in force · evidence: `package.json`, `app/WebVitalsReporter.tsx`

- **Context:** `next/web-vitals` wraps the raw package and does not expose attribution metrics. Two of six voters
  called the addition speculative; four accepted it as trivial (about 5 KB, no runtime cost).
- **Decision:** `web-vitals` stays a direct dependency so a fork can read attribution without a new install.
  `experimental.webVitalsAttribution: ['LCP', 'INP', 'CLS']` (`next.config.ts:87`) is the Next-side half: Next
  documents attribution as off by default and enabled per metric; this list is the set that carries it here.
- **Consequences:** revisit when a fork has built and never imports the raw package: then remove it.
- **Status:** in force; no fork data yet.

## Rejected, and the event that reopens each

2026-05 · in force · evidence: the 2026-05-23 decision panel; sibling `template-rn` carries the same register

- **React Compiler (`experimental.reactCompiler`):** vetoed on unanswerable evidence. facebook/react issues
  #35105 and #35644 (silent bailouts) were open and unconfirmed. Reopen when both close and a named app above
  100K monthly users publishes that they are ruled out. The Compiler's correctness rules already fire through
  `eslint-plugin-react-hooks`.
- **Lighthouse CI:** 3 URLs x 3 runs x 2 form factors is 18 runs, 9-18 minutes on every `verify:enterprise`.
  Reopen when `verify:enterprise` is the pre-PR gate AND a fork shows a regression LHCI would have caught, then
  scope it to one URL, three runs, desktop.
- **React Doctor as a `lint-staged` PR gate:** a project-level scan is not a staged-file linter. Reopen when it
  ships 1.0 AND a fork has a dated bug it would have caught, as an ad hoc `npm run doctor` plus a SHA-pinned
  action in `--offline` comment-only mode, never blocking.
- **Zstd compression:** Safari support landed in 26.3 but global support was 45 of 100 (caniuse, 2026-05). Brotli
  stays mandatory. Reopen at 80 of 100 AND when Next exposes per-route encoding negotiation.
- **Not applicable to web:** memlab, why-did-you-render, `react-native-flipper`, `vite-plugin-bundlesize`
  (reasons in `template-rn`'s register; `size:check` covers the bundle here).
- **Status:** in force.

## ESLint and Oxlint are layered, and the type-aware presets sit after the Oxlint block

2026-04 · in force · guard `npm run lint` · evidence: `eslint.config.js`, `.oxlintrc.json`

- **Context:** `eslint-plugin-oxlint` `flat/all` switches off every ESLint rule Oxlint implements, including rules
  `.oxlintrc.json` never enables. While Oxlint did not load `jsx-a11y` and `nextjs`, no linter checked 36 a11y
  and 21 `@next/next` rules at all.
- **Decision:** Oxlint loads `react`, `typescript`, `jsx-a11y` and `nextjs`. ESLint runs `eslint-config-next`, then
  `flat/all`, then `strictTypeChecked` and `stylisticTypeChecked` inside the TypeScript block so they come AFTER
  the Oxlint block. `no-misused-promises` sets `checksVoidReturn.attributes: false` for React handlers;
  `@ts-ignore` is banned and `@ts-expect-error` needs a description. Each carve-out (`next.config.ts`, `proxy.ts`,
  `app/**/route.ts`, tests) has its reason in `eslint.config.js`.
- **Consequences:**
  - Suppressions carry a reason: `eslint-comments/require-description` and `no-unlimited-disable` are errors;
    `no-unused-disable` is off because `--max-warnings 0` already fails on ESLint's own unused-directive report.
  - Oxlint's `control-has-associated-label` cannot see inside components, so an icon-only button needs an
    `aria-label` by convention.
  - `func-style: expression` is not enabled: routes, `proxy` and Server Actions use `export async function`.
- **Status:** in force.

## i18n is next-intl SSR with a `[locale]` segment

2026-04 · in force · guard `i18n/request.test.ts` · evidence: `i18n/routing.ts`, `AGENTS.md` § Architecture and contracts

- **Context:** a client-only i18next setup produced a flash of untranslated content and could not localize
  `generateMetadata`, canonical URLs or sitemap `hreflang`.
- **Decision:** `next-intl` with `i18n/routing.ts` (`defineRouting`), `i18n/request.ts` and `i18n/navigation.ts`;
  document routes live under `app/[locale]/`; `proxy.ts` composes the next-intl middleware with the nonce CSP and
  the rate limit. Server Actions translate through `getTranslations`. The single message source is
  `messages/<locale>.json`; the locale set is `['en']`, and a new locale needs `routing.locales` plus its file.
- **Consequences:** Next applies `title.template` only to descendants, so the root `app/layout.tsx` owns
  `title.default` and `title.template`, and `app/[locale]/layout.tsx` adds only `description`, `openGraph` and
  `twitter`.
- **Status:** in force.

## Rate limiting runs in `proxy.ts`; the limiter core is Edge-safe

2026-04 · in force · guard `shared/lib/rateLimitCore.test.ts`, `proxy.test.ts` · evidence: `shared/lib/rateLimit.ts`

- **Context:** `server-only` does not run in the proxy bundle or in Vitest.
- **Decision:** the limiter applies to `config.matcher` paths when the request is `/api/**` or carries
  `next-action`, so document-route Server Actions are covered. The default is the in-memory `rateLimitCore`
  (prune plus cap); with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set it is the distributed
  `shared/lib/upstashRateLimit.ts`. `rateLimit.ts` re-exports the core behind `import 'server-only'` for Node
  imports; `proxy.ts` and Vitest import `rateLimitCore.ts` directly; `shared/lib/index.ts` does not re-export the
  limiter, so `server-only` never reaches a client barrel.
- **Consequences:** `/dev/*` returns 404 in production from the same `proxy.ts` (`proxy.test.ts` covers it); this
  replaced mutating `config.entry` to drop `/dev` chunks, which broke on upgrades.
- **Status:** in force.

## Build and styling basics: webpack build, Tailwind v4, lockfile root, named vendor chunks

2026-03 · in force · evidence: `package.json` `build`, `next.config.ts:63`, `app/globals.css`

- **Webpack build.** `next build` defaults to Turbopack in Next 16, but this repo has a custom `webpack()` hook for
  vendor chunking and the bundle analyzer, so `build` and `build:analyze` run `next build --webpack`. `build:turbo`
  is an optional experiment.
- **Vendor chunks.** Production `splitChunks` uses named groups (React, Next, Zustand, UI, `i18nVendor`, form,
  `common`) so a dependency upgrade does not reshuffle critical vendors into anonymous chunks.
- **Tailwind v4.** Configuration lives in `app/globals.css` (`@import 'tailwindcss'`, `@theme inline`, tokens);
  there is no `tailwind.config.ts`. PostCSS runs `@tailwindcss/postcss` only, and `tw-animate-css` replaces
  `tailwindcss-animate`.
- **Parent lockfile.** Under a parent folder with another lockfile Next can pick the wrong workspace root, so
  `next.config.ts` sets `outputFileTracingRoot` and `turbopack.root` to the package directory.
- **Lint.** Next 16 removed `next lint`; `npm run lint` is `lint:oxlint` then `eslint . --max-warnings 0`.
- **Status:** in force.
