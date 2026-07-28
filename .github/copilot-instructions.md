# Review instructions

Next.js 16 App Router template, SEO-first, with next-intl SSR. Report correctness, security,
accessibility and test strength before style — style is ESLint's and Prettier's job, not a review
finding.

## Non-negotiable

- `npm run verify` is the bar and it is zero-warnings (`eslint --max-warnings 0`,
  `oxlint --deny-warnings`). A change that needs a rule downgraded, a severity lowered, a coverage
  threshold moved, or an `eslint-disable` to pass is a finding, not a fix.
- The frontend is not a security boundary. Anything `NEXT_PUBLIC_*` is inlined into the client bundle;
  a server-only value must not carry the prefix.
- `proxy.ts` branch order is load-bearing: nothing before the rate limiter, next-intl stays the terminal
  fallback. Treat a diff there as a security review.
- No secrets, keys or endpoints in committed files. `.env.example` carries placeholders; real values
  live in the host's environment. This holds for values that look harmless.
- Template scaffolding marked by inline `// Template scaffolding` comments and listed in
  `.cursor/brain/SKELETONS.md` (`features/example-form/**`, the Web Vitals pipeline, `lucide-react`
  wiring, `shared/constants`) is reference material. Removing it as "dead code" is a finding.

## Conventions the linter enforces — flag attempts to work around them

- Named constants, never bare literals in logic (`@typescript-eslint/no-magic-numbers`). Location is
  set by `.cursor/rules/constants.mdc`: co-locate for a single module, `src/store/<domain>/constants.ts`
  for store scope, `src/router/routes.ts` for paths.
- Design tokens, never raw hex, in `shared/ui/**` and `features/**`. Tokens live in `app/globals.css`
  under `@theme inline`.
- One-way FSD imports: `shared` may not import `app`/`features`/`entities`; `entities` may not import
  `app`/`features`; `features` may only reach into `app/actions`.
- `@/` alias only. Parent-relative imports (`../..`) are blocked.
- Explicit in/out contracts: a `FunctionComponent<Props>` annotation or an explicit return type.
  Interface callbacks use property style (`onSelect: (id: string) => void`), not method style.
- `FunctionComponent`, never the `FC` alias. Arrow functions, never function declarations.
- `logger` from `shared/lib/logger.ts`, never `console.*`.
- Every user-visible string goes through next-intl (`useTranslations` on the client, `getTranslations`
  on the server). New copy means new keys in `messages/<locale>.json` for every locale.
- Every `app/[locale]/*` entry calls `requireLocale()` then `setRequestLocale(locale)` before any client
  descendant renders. A missing call fails prerender with a swallowed `Error(void 0)`.

## Correctness patterns worth checking every time

- A test that still passes when the fix is reverted is not a test. Look for assertions that hold
  regardless of the behaviour under test, and for `toHaveTextContent('')` where
  `toBeEmptyDOMElement()` was meant.
- Every logic file under `app/`, `features/`, `shared/` or `i18n/` needs a co-located `*.test.*`; the
  pre-commit hook enforces existence, not quality. Judge the quality.
- A number that also appears inside a user-facing message must be interpolated from the same
  constant, or the two drift.
- Validate at boundaries with Zod (`shared/lib/api/safeFetch.ts`). Route handlers validate input AND
  output; Server Actions validate their output too, since the client receives `unknown`.
- `disabled` on an anchor does nothing, and on a button it drops focus to the body. Expect
  `aria-disabled` plus a click guard.
- Interactive elements need a visible focus state, a target of at least 44px, and a label associated
  with the control — not a placeholder standing in for one.
- Reduced-motion must resolve to the end state, not to a shorter animation.

## Conventions

- Conventional Commits, subject at most 96 characters.
- No ticket or task identifiers in code comments, test names, or commit messages. A comment states
  the constraint in plain words; traceability belongs to the branch and the pull request.
- English only in code, comments, commits and docs.
