# template-next-seo — agent guide

Operating contract for any AI agent editing this repo; read it in full before the first change. One canonical place per fact: rules live here, versions in `package.json` and the stack table of `.cursor/brain/PROJECT_CONTEXT.md`, the why in `.cursor/brain/DECISIONS.md`, the file map in `.cursor/brain/MAP.md`. **Code is ground truth:** if a line here conflicts with the code, follow the code and fix or flag the line in the same session. Cursor and Codex load this file natively and Claude Code through `CLAUDE.md`: edit THIS file, never the shim.

## Stack

SEO-first Next.js App Router **template, not a shipped product** (§ Danger zones): next-intl SSR under `[locale]`, FSD layers, a static + nonce CSP split, Upstash-ready rate limiting, a forkable scaffold. Node ≥ 24; the default `build` is `next build --webpack`. The installed Next ships its own docs in `node_modules/next/dist/docs/`: read the relevant guide before Next-specific code (`agentRules: false` keeps `next dev` from writing a copy of this pointer into this file).

## Invariants (do not violate)

1. **Scope lock.** Change only what the task requires: no "while I'm here" edits, no opportunistic refactors, no new abstraction for a single use site.
2. **One task = one commit,** Conventional Commits, subject ≤ 96 chars, no `Co-authored-by`, never `--no-verify`. Never push to `master` or force-push a shared branch: branch, gate, PR.
3. **The gate is tiered by moment, and it is defined in exactly one place:** § Commands (exact) › _The tier law_. This invariant is a pointer, not a copy; nothing is restated here.
4. **English only** in code, comments, commits and docs. Chat may be Russian; the repo is not.
5. **Locale set stays `['en']`** until the caller explicitly asks to expand it (`README.md` § Adding Languages).
6. **Zero warnings, no silencing.** `eslint --max-warnings 0` and `oxlint --deny-warnings`: never downgrade, silence or `eslint-disable` a rule to go green; raise it with the caller. Guards: `eslint-comments` (a reason on every suppression), `ban-ts-comment`, `strictTypeChecked`. The complexity thresholds in `eslint.config.js` sit above the measured ceiling: a hit means new drift, so split the function; raising a number needs a fresh measurement and a `DECISIONS.md` entry.
7. **Security surface is frozen** unless the task is explicitly security work: CSP directives in `next.config.ts`, the nonce pipeline in `proxy.ts`, the rate-limit matcher, COOP/CORP. `.claude/settings.json` asks before any edit of `next.config.ts` or `proxy.ts`.
8. **Template scaffolding is protected** (§ Danger zones).
9. **Explicit in/out contracts.** Components, hooks and handlers declare their output: `FunctionComponent<Props>`, an explicit return type, `Promise<ReactElement>` / `Promise<NextResponse>` for RSC and route entries (`explicit-function-return-type`); interface callbacks use property style (`method-signature-style`).

## Commands (exact)

Slash commands in `.claude/commands/` (shims in `.cursor/commands/`): `/onboard` orient and VERIFY the brain against the code · `/feat` reuse check → scope → plan → test-first → gate · `/test` corner cases at integration seams · `/review` leaks, security, bug hunt · `/docs` bring this file and the brain back in line with the code.

```bash
npm run verify:iter         # ITERATE: oxlint → tsc → vitest --changed (seconds; run per change)
npm run verify:measure      # MEASURE: build + look; `-- e2e/<f>.spec.ts` for one prod-mode spec
npm run e2e:one -- <spec>   # one Playwright spec on a FREE port, through the tracer
npm run test:one -- <file>  # one unit test file, through the tracer (not around it)
npm run probe -- <route> [widths]  # LOOK: render, screenshot per width, print measured quantities
npm run verify:push         # what pre-push runs: phase-aware (see gate-tiers.json / invariant 3)
npm run trace:report        # findings from .gate-trace.log (forbidden moments, budgets, worktrees)
npm run docs:check          # mechanical doc drift (pre-commit when docs are staged; weekly CI adds --weekly)
npm run fix                 # oxlint --fix → eslint --fix → prettier --write, repo-wide
npm run verify              # THE offline gate (alias of verify:enterprise): the push/CI chain, not a desk tool
```

Every other script, one line each: `README.md` § Commands. After cloning run `npm run prepare` once (`.npmrc` disables lifecycle scripts, so husky does not install itself; `min-release-age=3` is a dependency cooldown in DAYS, so an urgent new package needs `--min-release-age=0`) and copy `.env.example` (`scripts/check-build-env.mjs` names the fix when the production build lacks `NEXT_PUBLIC_APP_URL`).

<!-- shared-harness:begin -->
<!-- This block is byte-identical in all four templates (template-1, template-spa-pwa, template-next-seo, template-rn). Change it in every template in the same commit, or not at all. Stack-specific facts (which stages `verify` runs, ports, what is skipped and why, timings) live OUTSIDE this block: in the command table above and in `.cursor/brain/VERIFICATION.md`. -->

### The tier law - this section is the ONLY place it lives

Every other file (rules, commands, brain, README, Copilot instructions) points here and restates nothing.
A restated pipeline rule goes stale in place; a stale copy cost a sibling repo a day of 40-minute rounds
because five copies still demanded the full chain before the first report. `scripts/gate-tiers.json` is
the machine-readable form (expected and forbidden scripts per moment, budgets, phase); when this prose and
that file disagree, the file wins and the prose is fixed in the same commit.

**Four moments, and one that is not a gate.**

- **Iterate** - per change, seconds. Run `verify:iter`. Where the change touches a surface that has its
  own spec and the repo has a browser lane, run that ONE spec through the traced single-spec script (see
  the command table). Nothing heavier.
- **Measure** - whenever only a rendered result can answer the question: the measure script (build +
  look) or the probe, where the repo has them. Legal at any time, in any lane, never a violation.
  Measuring is not verifying: it runs no lint, no types, no tests.
- **Commit** - the pre-commit hook owns it: staged autofix, the TDD sibling gate, then the repo-wide cheap
  checks. Nothing to run by hand; on refusal the hook prints the remedy.
- **Push** - the pre-push hook runs the gate ONCE, never shortened by what the diff touched. Where the
  repo has heavy stages (build, size, e2e), the push script is phase-aware: phase 0 (scaffold, before the
  first deploy) runs the offline checks and loudly SKIPS the heavy stages; phase 1 (from the first deploy)
  runs the full `verify:ci`. A skipped stage is printed, never silent; flip the phase in one commit at the
  first deploy. A repo whose gate has no heavy stage runs the full `verify:ci` at push and records in
  `gate-tiers.json` that a phase switch would gate nothing.
- **CI** - phase-blind: always the full `verify:ci` (`audit:gate` + `verify`), plus what only CI can do
  (the security workflow, the scheduled mutation job, a mandatory dev-smoke job where the repo has one).

**Prohibitions, stated as such.** An implementer or a reviewer NEVER runs `verify`, `verify:ci`,
the fuller `verify:*` variants, `build` or the e2e suite by hand: the full chain belongs to the push hook and CI, and a
result an agent cannot act on is not worth its minutes. A review round gets the diff plus `verify:iter`;
acceptance does not re-run the gate, the push does. Parallel lanes never run heavy stages (one machine,
shared caches): heavy work serialises at the push. Individual scripts (`typecheck`, `lint`, `test`, `fix`)
are drill-downs on a specific failure; none of them is a moment.

**A red push costs one fix, not another round of the whole gate.** Where the repo has a browser suite, it
stops after a capped number of failures on the gate run and in CI (`maxFailures`) instead of running every
remaining test into its timeouts. After a red push, whoever pushes fixes the cause, rebuilds only when the
failing stage runs against a build, re-runs only the tests that failed until they pass, then pushes again;
the push still runs the whole gate and reaches whatever the cap stopped short of. Name the failed spec files
from the red output: Playwright's `--last-failed` also re-runs every test a capped run never reached, which
is most of the suite, so it fits only a red that finished under the cap (Jest's `--onlyFailures` has no such
catch). That re-run is a drill-down on a known failure, so it is the one sanctioned hand-run of a build or of
browser tests, and it never replaces the push. Each browser config writes to its own output folder, so the
last-failed record always belongs to the suite that failed.

**What earns a browser test.** The browser suite is counted in INVARIANTS, not in screens. A new route
or a new component earns a browser test only when it brings an invariant the existing specs do not
already measure: a different layout shell, an engine-dependent behaviour, the first instance of a flow
class. Everything else is a unit test against a mocked network, which runs in the iterate moment and
costs the push nothing. `gate-tiers.json` declares the suite's ceiling and `docs:check` reports a suite
that outgrew it, so that number moves on a measurement and a `DECISIONS.md` line, never on habit.

**`verify` is a strict superset of the offline checks CI runs**, so a green `verify` predicts a green CI.
Keeping that true is a rule: a new check goes into the script, never only into the workflow file.
`audit:gate` sits in `verify:ci` rather than `verify` because it needs the network, so an offline agent can
still run the whole offline gate. `bench:verify` derives its step list from the `verify` script; a
hand-written second list has already drifted once.

**Every gate run is traced** to `.gate-trace.log`; `trace:report` turns the log into findings (forbidden
moments, blown budgets, gate runs from a worktree). After a push, gate output in the terminal is part of
the contract: **silence is a failure, not a pass** - a push that printed no gate ran no gate, whatever the
exit code says.

**Ports.** A busy port means MOVE, never kill a server you did not start; the single-spec and measure
scripts take the next free port. Only the push gate clears its own port.

### Lanes - who runs what

- **Main agent, inline.** Iterate and measure while working; the push runs the chain. Never the full gate
  by hand.
- **Implementer subagent.** Works in a hand-made `git worktree` OUTSIDE the repo directory, on its own
  port, with `node_modules` symlinked from the main checkout. Iterate and measure only; the gate never
  runs from a worktree (the tracer records it as a finding). The lead removes the worktree, checks the
  branch out in the main checkout and pushes from there, so the gate runs once, at the push, for every
  writer.
- **Copilot coding agent.** Hand-over is a fully specified issue (goal as behaviour, paths in scope,
  acceptance, out of scope; use `.github/ISSUE_TEMPLATE/agent-task.yml` where the repo ships it), assigned
  to Copilot. It works on its own branch and opens a draft pull request; workflows on that PR start only
  after a human approves the run. Task class: verifiable by the gate, under ~400 changed lines, contract
  stated in the issue, nothing on the mandatory-human-review list. Its review context is
  `.github/copilot-instructions.md`, which points here for the gate.
- **Review, any lane.** The diff plus `verify:iter`, never a re-run of the gate. Findings are correctness,
  test strength, security, readability; style belongs to the linters. A non-author human approves; an
  agent's own green is not an approval.
- **Two tools, one file.** Claude Code reads `CLAUDE.md` -> `AGENTS.md` -> the brain files this guide
  points at (read on demand; nothing beyond `AGENTS.md` is `@`-imported); Cursor reads `AGENTS.md` plus
  every `alwaysApply: true` rule; Copilot reads `.github/copilot-instructions.md`. `AGENTS.md` is the only
  file all of them read, which is why the law lives here and everything else is a pointer.
- **What an agent may not do.** `.claude/settings.json` holds the agent-side limits; they bind Claude Code
  only (Cursor, Copilot and Codex do not read that file). Denied in every permission mode, bypass
  included: reading .env files other than the example, editing `.claude/settings.json` itself, a force
  push (a `+branch` refspec too), `--no-verify` or `-n` on a commit, `--no-verify` on a push,
  `git reset --hard`, `git clean -f`. Asked before every edit of the gate files, the documented edits
  included (the phase flip, a raised mutation threshold): `.husky/`, `.github/workflows/`,
  `.github/ruleset.json`, `scripts/gate-tiers.json`, `stryker.config.json`, `.npmrc`. A rule matches the
  command or path as an agent usually writes it and is not a security boundary: `sh -c`, a full binary
  path, a `git -C` or `git -c` prefix, a bundled flag such as `-uf`, or a command that reads a file
  without naming it (`grep -r`) walks past it. The boundary is the required CI check on the default
  branch. To change a guarded file, edit it yourself or change the rule in a reviewed commit.

### Before code - spec and plan

A task bigger than a one-sentence diff gets two tracked files under `.cursor/<feature-slug>/` before the
first edit: `SPEC.md` (WHAT and WHY: evidence per claim with its source kind, acceptance criteria as
Given / When / Then, open questions with `blocking` and `evidence tried` - an unknown is parked there,
never invented) and `PLAN.md` (HOW: changes per file with the code that was read, what is reused,
sequencing in 2-7 slices each under ~400 changed lines, a test per acceptance criterion, risks, danger
zones). Copy both from `.cursor/templates/`. Approval is a non-author review of the pull request that
adds or changes them, never a phrase in a chat recorded by an agent. `/feat` starts from the plan; a plan
that lives only in a conversation is not a plan.

<!-- shared-harness:end -->

## Version holds (do not "fix" by bumping)

`scripts/version-holds.json` is the register (range, reason, lift condition, evidence); `scripts/check-version-holds.mjs` runs in `verify` and fails a bump past a hold, a hold without its Dependabot `ignore`, and a hold on an absent package. One line per hold:

- `vitest`, `@vitest/coverage-v8` stay `<5`: the Stryker vitest runner kills 0 of 48 mutants under vitest 5.
- `typescript` stays `<6.1`: `typescript-eslint` peers `<6.1.0`, and a bump to 7 breaks `npm install` and `npm ci` with ERESOLVE.
- `eslint`, `@eslint/js` stay `<11`: three plugins still peer ESLint `^9`, bridged by the `$eslint` entries in `overrides` (keep them; no `--legacy-peer-deps`); `settings.react.version` stays a literal, never `'detect'`.
- `@types/node` stays `<25`: the types match `engines.node >=24`.
- `oxlint` tilde-tracks `eslint-plugin-oxlint` (lockstep releases).
- `overrides` in `package.json` are security floors WITH a major cap (`">=fixed <next-major"`): never remove one to quiet npm, never write one uncapped (`DECISIONS.md` § Advisory exceptions).

## Architecture and contracts

- **FSD, one-way imports:** `app → features → entities → shared`, absolute `@/*` imports, no deep relative paths across layers, no circular barrels. Reuse first: search for an existing equivalent before creating one, and match the surrounding file. Map: `.cursor/brain/MAP.md`.
- **Content and rendering:** anything that renders authored copy is proven against content it has not seen (`minimal` / `typical` / `long` / `unbroken` text, `none` / `one` / `many` collections), and engines disagree about layout, so measure (`CROSS_BROWSER=1`), never predict (`DECISIONS.md` § Content variance, § Cross-engine coverage).
- **i18n (next-intl SSR):** `messages/<locale>.json` is the only message source. Every page and layout narrows the route param with `requireLocale()` from `@/i18n/request-locale` and calls `setRequestLocale(locale)` BEFORE any client descendant renders; Server Actions use `getTranslations({ locale })`. The root `app/layout.tsx` owns `title.default` + `title.template` (Next applies a template only to descendants): do not move it down.
- **Security:** the static document CSP lives in `next.config.ts` `headers()`, the nonce CSP with `strict-dynamic` in `proxy.ts` for its matcher. `proxy.ts` composes next-intl, nonce CSP, rate limit and the `/dev` production gate in a fixed order: do not reorder, and add no branch BEFORE the rate limiter (it gates on `isApi || isServerAction`). Matcher coverage is the only guarantee a route is throttled. COOP/CORP `same-origin` may break OAuth popups: use same-tab redirects. **Never commit keys or configuration values, public ones (`NEXT_PUBLIC_*`, a Firebase web config) included:** `.env.example` placeholders only, real values in the deploy platform's secret store and GitHub Secrets (`NEXT_PUBLIC_*` is inlined into the client bundle, so treat it as world-readable, which is still no reason to commit it). Detail: `.cursor/brain/SKELETONS.md`.

## Danger zones

- **`next.config.ts`:** the custom webpack `splitChunks` breaks under `next build` without `--webpack`; its import graph is alias-free (Next loads the config before any `@/` alias exists, so use relative imports only, or the build fails with `Cannot find module`).
- **`app/[locale]/*`:** a missing `setRequestLocale` swallows errors as `Error(void 0)` in prerender.
- **Template scaffolding** (`lucide-react`, `shared/constants/index.ts`, `features/example-form/**`, the Web Vitals pipeline; each site is marked `// Template scaffolding`) is load-bearing: strip it only when the caller says "this is now my MVP". Full list with mitigations: `.cursor/brain/SKELETONS.md`.
- **Machine-agnostic configs:** no absolute local paths in committed configs (keep `i18next.i18nPaths` relative: `messages,i18n`), and no DURATION measured on one machine: the push budget in `scripts/gate-tiers.json` holds a ratio and a sample size, never seconds.

## Out of scope (ask before touching)

Locales or `routing.defaultLocale`; CSP, the nonce pipeline, the rate-limit matcher, COOP/CORP; `engines.node` or `.npmrc` hardening flags; anything tagged `// Template scaffolding` or in the README restore playbook; analytics or telemetry vendors, or `app/api/vitals` beyond logging; the default build tool (webpack ↔ Turbopack); weakening the gate, a lint severity or a coverage threshold to get green. When unsure, state the intent and wait: "I don't know" beats guessing.

## Pull requests, brain docs, replies

- **Changes reach `master` through a pull request:** branch, push, open a PR, merge when CI is green. Here `master` carries a ruleset (`.github/ruleset.json`); in a FORK settings do not travel, so a direct push is unprotected until you switch the rules on (`README.md` § What your fork does not inherit).
- **Brain docs, read on demand and never `@`-imported:** start at `.cursor/brain/READING_INDEX.md` (situation → the files that answer it), then `PROJECT_CONTEXT.md` (purpose, stack table), `MAP.md`, `SKELETONS.md` (danger zones), `VERIFICATION.md` (what each stage runs), `DECISIONS.md` (the why, one entry per decision). Check the work is still needed (`git log --oneline -15` and one grep), LOOK with `npm run probe` before inferring pixels, and name the files when you dispatch work to another agent. Which tool reads which file: § The tier law › Lanes › _Two tools, one file_.
- **Replies:** end non-trivial work with `Confidence: HIGH | MEDIUM | LOW — reason`, cite `path/to/file.ts:LINE` for code claims, prefer editing to creating, no emojis unless asked.
- **Maintaining this file:** add a rule when the same mistake happens twice, one line tied to the observed failure; prune stale lines; depth lives in `.cursor/brain/`.
