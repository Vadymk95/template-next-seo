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
| prod-mode e2e + Turbopack smoke | no | same flip — a prod boundary now exists |
| coverage thresholds | already on (suite ships with real tests) | — |
| cross-browser geometry job | CI-only (`CROSS_BROWSER=1`) | unchanged by phases |
| mutation score (weekly CI) | unchanged by phases | — |

**`verify` is a strict superset of CI's offline checks**, so a green `verify` predicts a green
`validate`. The rule that keeps it true: **a new check goes into the script, never only into the
workflow file.**

## The tracer, and what silence means

Every `verify:*` and `test:e2e` run appends one TSV row to `.gate-trace.log` (gitignored);
`npm run trace:report` turns rows into findings — a forbidden stage run standalone, a run over its
moment's budget, a code check against a docs-only change, a push from a linked worktree. The
discipline changes by editing `scripts/gate-tiers.json`, never the analyser. Telemetry sees WHO ran
WHAT and HOW LONG; whether a check CAN fail is mutation-proving's job, not the tracer's.
**After a push: gate output present in the terminal is part of the contract — silence is a
failure, not a pass.** A push that printed no gate ran no gate, whatever the exit code says.

## Ports — busy means MOVE; only the gate kills

Parallel lanes share one machine: `e2e:one` and `verify:measure` take the next free port
(`scripts/run-on-free-port.mjs`) and Playwright tears down the server it started. Never kill a
server you did not start. The push gate alone clears its own port
(`check-gate-env --kill-port` — SIGTERM, re-probe, refuse if it will not die). Stray hunting by
hand: `lsof -nP -iTCP:3000-3020 -sTCP:LISTEN`.

---

## Minimal check by task type

- **Docs only** — `npm run format:check`
- **TS/TSX / tests** — `npm run verify:iter`
- **i18n copy only** (VALUE edits in `messages/<locale>/*.json`, no key changes) — `npm run format:check`.
  A key add/rename is a TS/TSX-class change: the typed messages make `verify:iter` catch it.
- **Routing, i18n INFRA (`i18n/*.ts`, the locale set), `proxy.ts`, `next.config.ts`** — `npm run verify:full`
- **A shared UI primitive, the chrome (`Header`/`Footer`), or `app/globals.css`** —
  `npm run verify:full`. Anything content-bearing has to be measured against content it has not seen;
  the unit suite cannot do it because jsdom has no layout.
- **A geometry invariant, a wrap guard, or anything about how text lays out** — additionally
  `CROSS_BROWSER=1 npm run smoke:dev` and `CROSS_BROWSER=1 npm run test:e2e:prod`.
- **Added or bumped a dependency** — `npm run audit:gate`, plus `npm run build`.

---

## Content variance

Any component that renders authored copy must be proven against content it has not seen. The states live
in `app/dev/ui/content-stress/stressMatrix.ts`: `minimal` / `typical` / `long` / `unbroken` for text and
`none` / `one` / `many` for collections. `unbroken` is the one that finds a missing wrap guard — a long
sentence wraps on its spaces and hides the defect.

- **A chrome LABEL and PROSE are different content kinds.** The fixture keeps separate sources: `Button`
  keeps `whitespace-nowrap` by contract, so feeding it a paragraph measures the wrong thing. Measured
  here before the split: 568px of button content in a 292px column, which reads as a broken primitive
  and is not one.
- **The RANGE a guard covers is part of its specification.** Both geometry specs sweep
  390 / 640 / 768 / 1024 / 1440. A guard proven at one width usually just moves the defect.
- **A wrap class with no red-to-green proof gets deleted.** Decoration in a shared component is what the
  next author copies.
- **Do not reason about what a browser does — run it.** `CROSS_BROWSER=1` adds Firefox and WebKit.
  Measured on the sibling template: Firefox reports `clientWidth: 0` for an inline `<label>` per CSSOM
  while Chromium reports a box.

**Known limitation, stated rather than hidden:** the geometry PREDICATES are shared
(`e2e/support/geometry.ts`), but the in-page MEASUREMENT is a separate copy in each of the two specs.
That is how the form-field handling once landed in one and not the other. Change both together.

---

## Capturing results honestly

```bash
npm run verify > /tmp/verify.log 2>&1; echo $?
```

**Without a pipe.** Piping to `tail` returns the pipe's exit status, so a failed build reads as a pass.

Green also means nothing until you have seen the gate go red. When you add or change a check, break it
once on purpose and confirm it refuses, then revert.

**Before believing a green result, name the concrete condition under which it would have been RED.** If
you cannot name one, the check proved nothing. Three real shapes here: a layout measurement of a page
that had not rendered passes every invariant vacuously (both geometry specs assert a non-empty
measurement); a Playwright `testMatch` that selects nothing collects zero tests and exits 0
(`scripts/check-cross-browser-selection.mjs` asks Playwright instead of assuming); and
`vitest --coverage` prints `Excluding it from coverage` for a file it could not parse and then exits 0
(`scripts/check-coverage.mjs` refuses on that marker).

---

## Brain sync

If you add or change a script, a CI step or a hook, update this file **and** `PROJECT_CONTEXT.md`
**and** the `AGENTS.md` command list in the same change. Three places describe the gate, and all three
have been stale at the same time before.
