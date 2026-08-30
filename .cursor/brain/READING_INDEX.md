# Reading index — what to open, by SITUATION

Two maps already exist and this is neither. `AGENTS.md` says what the RULES are; `MAP.md` says what
each file IS. Neither answers "I am about to do X — what do I open first", which is this file's only
job: the trigger, not the content. **It points and never restates** — a line summarising a doc rots
the moment that doc changes; a line naming the doc and its section does not. Where two files could
answer, the entry says which one WINS.

Why it exists, measured on a sibling project (2026-08-30): an agent's entry is dominated by READING
SOURCE to find out where things are — roughly 93% of a lane's spend before it writes anything, while
the auto-loaded docs are ~7%. The lever is precision of pointing, not smaller documents. The single
biggest observed difference between a 33-tool lane and a 191-tool lane was how exactly the task
named its files.

## 1. Picking this repo up cold

- `AGENTS.md` — WINS: the operating contract, the invariants, the tier law (Invariants #3).
- `.cursor/brain/PROJECT_CONTEXT.md` — stack, layout, what CI runs.
- `.cursor/brain/MAP.md` — every route and file with its responsibility; read it INSTEAD of sweeping
  `app/`.

## 2. About to change a shared UI primitive or the chrome

- `.cursor/brain/MAP.md` "Layout invariants and content variance" — WINS: which spec measures what,
  and where the shared predicates live.
- `npm run probe -- <route>` — LOOK at the result at three widths before reasoning about it; one
  measurement replaces a round of inference.
- `app/dev/ui/content-stress/stressMatrix.ts` — add a case when the component renders authored copy.

## 3. About to add or change a route

- `.cursor/brain/MAP.md` — WINS: the route table, including which entries are thin re-exports.
- `.cursor/brain/SKELETONS.md` "i18n" — `setRequestLocale` before any client descendant, and the
  title-template quirk.
- `AGENTS.md` § i18n contract — the mechanical procedure and the typed-messages contract.

## 4. About to touch security: CSP, the proxy, headers, rate limiting

- `.cursor/brain/SKELETONS.md` "`proxy` composition", "COOP / CORP / strict CSP" — WINS: the order
  that must not change and why.
- `.cursor/brain/DECISIONS.md` "Content Security Policy: nonce on dynamic…" — what was tried,
  measured and rejected; do not re-litigate from scratch.
- `AGENTS.md` § Out of scope — this surface needs the caller's confirmation before an edit.

## 5. About to touch a gate, a hook, or CI

- `AGENTS.md` Invariants #3 — WINS: the tier law itself (what runs at which moment, the prohibitions).
- `.cursor/brain/VERIFICATION.md` — the mechanics: the phase table, the tracer, the port rules.
- `scripts/gate-tiers.json` — the moments/budgets as DATA; the discipline changes by editing this.

## 6. About to add a dependency, or an advisory went red

- `.cursor/brain/DECISIONS.md` "Override floors" + `AGENTS.md` § Version holds — WINS: the floor
  rules (a floor carries a major cap; an allowance is the last resort and needs an expiry).
- `scripts/audit-allowlist.json` — the current allowances and their reasons.

## 7. Wondering whether the work is still needed

Before reading anything else: `git log --oneline -15`, then grep for the thing the task names. On the
sibling project two of five dispatched lanes returned "already done" after ~430k tokens between them,
and both were answerable by five minutes of grep. **This entry is first in cost order even though it
is last in the list.**

## Keeping this honest

Add a situation only after an agent was actually sent to the wrong file over it. When two files could
answer, name which one WINS — never list both and leave the reader to guess.
