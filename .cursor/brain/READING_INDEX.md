# Reading index — what to open, by SITUATION

Two maps already exist and this is neither. `AGENTS.md` says what the RULES are; `MAP.md` says what
each file IS. Neither answers "I am about to do X — what do I open first", which is this file's only
job: the trigger, not the content. **It points and never restates** — a line summarising a doc rots
the moment that doc changes; a line naming the doc and its section does not. Where two files could
answer, the entry says which one WINS.

Why it exists: `AGENTS.md` § Pull requests, brain docs, replies.

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
- `.cursor/brain/SKELETONS.md` "i18n" — the root layout and `next/root-params`, where root params are
  not readable, and the title-template quirk.
- `AGENTS.md` § Architecture and contracts › i18n — the mechanical procedure.
- `.cursor/rules/project-config.mdc` § SEO and i18n usage — the typed-messages contract.

## 4. About to touch security: CSP, the proxy, headers, rate limiting

- `.cursor/brain/SKELETONS.md` "`proxy` composition", "COOP / CORP / strict CSP" — WINS: the order
  that must not change and why.
- `.cursor/brain/DECISIONS.md` "Content Security Policy: nonce on dynamic…" — what was tried,
  measured and rejected; do not re-litigate from scratch.
- `AGENTS.md` § Out of scope — this surface needs the caller's confirmation before an edit.

## 5. About to touch a gate, a hook, or CI

- `AGENTS.md` Invariants #3 — WINS: the tier law itself (what runs at which moment, the prohibitions).
- `.cursor/brain/VERIFICATION.md` — the mechanics: the phase table, the tracer, the port rules.
- `scripts/gate-tiers.json` — the moments/budgets as DATA, and the readable stage chain of every gate script (`checks.<name>.chain`); the discipline changes by editing this.

## 6. About to add a dependency, or an advisory went red

- `.cursor/brain/DECISIONS.md` "Advisory exceptions are data" + `AGENTS.md` § Version holds — WINS: the floor
  rules (a floor carries a major cap; an allowance is the last resort and needs an expiry).
- `scripts/audit-allowlist.json` — the current allowances and their reasons.

## 7. About to add what the baseline leaves out: a backend, auth, monitoring, analytics, a language, images, a deploy

- `.cursor/brain/EXTENSIONS.md` — WINS: one recipe per integration, in the order a project meets them
  (trigger, install, where it plugs in, the guard to add, what not to do).
- `SECURITY_REQUIREMENTS.md` — the statements the recipe must not break, and the pre-deployment
  checklist the deploy phase points at.
- `AGENTS.md` § Out of scope — each of these needs the caller's confirmation before the first edit.

## 8. Wondering whether the work is still needed

Before reading anything else: `git log --oneline -15`, then grep for the thing the task names. On the
sibling project two of five dispatched lanes returned "already done" after ~430k tokens between them,
and both were answerable by five minutes of grep. **This entry is first in cost order even though it
is last in the list.**

## Rule routing

Before planning or editing in a task area, read the matching rules in `.cursor/rules/` (`global.mdc` § 0.1 says why;
`agent-pipeline.mdc` Step 1 asks for the Rule Receipt). The always-on core is `agent-pipeline`, `workflow` and
`global`; everything else is conditional.

- **React / UI / Server or Client Components / Metadata** → `react-patterns.mdc`, `performance.mdc`, `project-config.mdc` (design tokens, states, a11y, i18n usage)
- **App Router routes / layouts / `sitemap` / `robots` / `generateMetadata`** → `routing.mdc`, `react-patterns.mdc`, `project-config.mdc`
- **New behavioral component, changed behavior, tests, fixtures, mocks** → `testing.mdc` **before** implementation, `test-driven-development.mdc` (+ `shared/lib/test-utils`)
- **API route handlers / Server Actions / payload contracts** → `routing.mdc`, `resilience.mdc`, `async-error-handling.mdc`, `typescript.mdc`
- **Zustand stores / `createSelectors` / client-global state** → `state-management.mdc`, `typescript.mdc`
- **Async / error handling / debugging** → `async-error-handling.mdc`, `resilience.mdc`
- **Styling / render-perf / memo / list keys** → `performance.mdc`
- **Constants / enums** → `constants.mdc`
- **Types / interfaces / file-size discipline** → `typescript.mdc`, `engineering-standards.mdc`
- **Commit flow** → `commit-command.mdc`
- **Any `.ts` / `.tsx` / `.js` / `.jsx` edit (formatting, naming, file structure)** → `code-style.mdc`
- **New module placement / cross-layer imports / what the shared pipeline leaves to this repo** → `fsd-architecture.mdc`
- **A danger zone or the frozen security surface** → `.cursor/brain/SKELETONS.md` and `AGENTS.md` § Danger zones, § Out of scope (the approval threshold of `workflow.mdc` § The Approval Law names the same list)

## Keeping this honest

Add a situation only after an agent was actually sent to the wrong file over it. When two files could
answer, name which one WINS — never list both and leave the reader to guess.
