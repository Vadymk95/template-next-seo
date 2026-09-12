# Verification — when to run what (agents & humans)

**Goal:** match checks to the MOMENT. The tier law itself lives in `AGENTS.md`, Invariants #3 —
one place, everything else points. This file holds the mechanics and the phase table.

## The moments and their commands

- **Iterate — `npm run verify:iter`**: `lint:oxlint` → `typecheck` (incremental) →
  `vitest run --changed --passWithNoTests`. Seconds; run after every change. Two deliberate
  properties: while `package.json` or a vitest config is dirty, `--changed` runs the FULL suite
  (force-rerun triggers); and `--changed` follows the import graph only, so cross-cutting suites
  surface at the push chain, not during iteration. One touched spec: `npm run e2e:one -- <spec>`.
- **Measure — `npm run verify:measure [-- <spec>]`**: build + look (optionally one prod-mode spec
  on a free port). Legal at ANY moment, unlimited runs — a measurement is work, not a violation.
  It deliberately runs no lint/types/tests: measuring is not verifying.
- **Commit — the pre-commit hook**: staged autofix → TDD sibling gate → repo-wide
  oxlint/format/tsc. Nothing to run by hand.
- **Push — `npm run verify:push` (the pre-push hook runs it)**: PHASE-AWARE, see the table below.
- The full chains (`verify`/`verify:enterprise` = offline gate incl. build + prod e2e;
  `verify:ci` = + audit; `verify:full` = + Turbopack smoke) belong to the push hook and CI — they
  are not desk tools and are never run by hand.

## Phases — what a push proves, and the trigger that adds more

`scripts/gate-tiers.json` `"phase"` decides; `scripts/verify-push.mjs` dispatches; the skip is
printed on every phase-0 push. `GATE_PHASE=full` overrides per run (how gate machinery itself is
pushed). CI always runs the full chain — the phase gates only the LOCAL hook.

| Check | Runs at phase 0 (scaffold) | Added when (the trigger) |
| --- | --- | --- |
| audit, hooks-check, format, tsc, lint, coverage | yes — every push, ~10s | day one |
| production build in the gate | no | the FIRST DEPLOY: flip `"phase": 1` in its own commit |
| prod-mode e2e | no | same flip — a prod boundary now exists |
| Turbopack smoke (`smoke:dev`) | CI-only (`dev-smoke` job); never inside `verify:ci` | unchanged by phases |
| coverage thresholds | already on (suite ships with real tests) | — |
| cross-browser geometry job | CI-only (`CROSS_BROWSER=1`) | unchanged by phases |
| mutation score (weekly CI) | unchanged by phases | — |

Measured here (`.gate-trace.log`, 2026-08-30 → 2026-09-11, 17 `verify:push` rows): a phase-0 push 9.9-12.7 s
on seven runs, 20.7 and 33.7 s on two 2026-09-07 runs; the full chain (`GATE_PHASE=full`, or phase 1)
23.4-30.2 s on 2026-08-30 and 37.7 s on 2026-09-06 — the `push` budget in `gate-tiers.json` is 45 s (the slowest observed full chain plus ~20%; the p90 of
the 17 rows = 33.7 s, plus ~20 %, rounded to 5 s); `verify:iter` 1.8-2.4 s on a docs-only change, 28.5 s once
on a mixed change that ran the full suite; `verify:measure` 12.0 s (18.7 s on a failing run); the mutation run
2m28s (`mutation.yml`).

The superset rule and the push/CI split: `AGENTS.md` § the tier law; why: `DECISIONS.md` § "[2026-07] The
gate ladder".

## The tracer — how it works (the RULES it enforces are the tier law)

Every `verify:*` and `test:e2e` run appends one TSV row to `.gate-trace.log` (gitignored);
`npm run trace:report` turns rows into findings — a forbidden stage run standalone, a run over its
moment's budget, a code check against a docs-only change, a push from a linked worktree. Moments,
budgets and classes are DATA in `scripts/gate-tiers.json`; the analyser names no stage, so the
discipline changes by editing that JSON. Telemetry sees WHO ran WHAT and HOW LONG; whether a check
CAN fail is mutation-proving's job, not the tracer's.

## Ports — the mechanics

`e2e:one` and `verify:measure` route through `scripts/run-on-free-port.mjs`, which probes up from
the base port and exports `PORT` + `PLAYWRIGHT_BASE_URL`; Playwright tears down the server it
started. The push gate's preflight takes `--kill-port` (SIGTERM, re-probe, refuse if it will not
die). Stray hunting by hand: `lsof -nP -iTCP:3000-3020 -sTCP:LISTEN`.

---

## Minimal check by task type

- **Docs only** — `npm run format:check`
- **TS/TSX / tests** — `npm run verify:iter`
- **i18n copy only** (VALUE edits in `messages/<locale>/*.json`, no key changes) — `npm run format:check`.
  A key add/rename is a TS/TSX-class change: the typed messages make `verify:iter` catch it.
- **Routing, i18n INFRA (`i18n/*.ts`, the locale set), `proxy.ts`, `next.config.ts`** —
  `npm run verify:iter`, and SAY SO in the hand-over: the build/e2e/smoke surface belongs to the push
  chain and CI, not to a hand-run.
- **A shared UI primitive, the chrome (`Header`/`Footer`), or `app/globals.css`** — content-bearing
  work has to be MEASURED against content it has not seen (jsdom has no layout), so this is the
  measure moment: `npm run verify:measure -- e2e/layout-geometry.spec.ts`, or `npm run smoke:dev` for
  the dev-only content-stress fixture.
- **A geometry invariant, a wrap guard, or anything about how text lays out** — measure with
  `CROSS_BROWSER=1 npm run smoke:dev`; the CI cross-browser job is what gates it.
- **Added or bumped a dependency** — `npm run audit:gate` (it is the one network check, and cheap).

---

## Content variance

The rule: `AGENTS.md` § Architecture › Content variance. Why and what it found: `DECISIONS.md` § Content
variance is measured in a browser. Which spec measures what, and where the shared predicates and the one
in-page measurement live: `MAP.md` § Layout invariants and content variance.

---

## Capturing results honestly

The checklist (exit code without a pipe, prove the gate can go red, name the condition under which a
green would have been red): `.cursor/rules/agent-pipeline.mdc` § 4.1a — one home.

---

## Brain sync

If you add or change a script, a CI step or a hook: the tier LAW is `AGENTS.md` Invariants #3 and
lives there alone; the MECHANICS are this file; `PROJECT_CONTEXT.md` and the `AGENTS.md` command list
carry only the command names. Update what the change actually touches — and never re-state the law in
a second file, which is how three descriptions of one gate were stale at the same time.
