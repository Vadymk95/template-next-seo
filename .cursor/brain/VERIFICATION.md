# Verification — when to run what (agents & humans)

**Goal:** match checks to the change. Do **not** run the full gate for every tiny edit — but never
declare a task done on a targeted check alone.

## The three rungs

- **`npm run verify`** (alias `verify:enterprise`) — every OFFLINE check: `check-hooks` → lint → format
  → typecheck → `test:coverage` → `check-build-env` → build (webpack) → `ensure-playwright` →
  `test:e2e:prod` (Playwright vs `next start`).
- **`npm run verify:ci`** — `audit:gate && verify`. Husky **pre-push** runs it; the CI `validate` job is
  one step over the same script.
- **`npm run verify:full`** — `verify:ci && smoke:dev`. `smoke:dev` drives the Turbopack dev server and
  is the only thing that exercises the content-variance fixture, which is mounted only outside
  production. CI runs it as its own `dev-smoke` job.

**`verify` is a strict superset of CI's offline checks**, so a green `verify` predicts a green
`validate`. The rule that keeps it true: **a new check goes into the script, never only into the
workflow file.**

---

## Minimal check by task type

- **Docs only** — `npm run format:check`
- **TS/TSX / tests** — `npm run lint && npm run typecheck && npm test`
- **Routing, i18n, `proxy.ts`, `next.config.ts`** — `npm run verify:full`
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
