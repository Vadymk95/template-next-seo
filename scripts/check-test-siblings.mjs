#!/usr/bin/env node
// TDD-gate (deterministic): every staged src LOGIC file must have a co-located
// *.test.* sibling. Enforces "tests EXIST" — not "tests-first" (ordering can't be
// hook-forced; that stays an advisory practice). Blocks the commit (exit 1) on a
// missing sibling so a model that skips tests cannot land untested logic.
//
// Usage:
//   node scripts/check-test-siblings.mjs                 # checks staged files (pre-commit)
//   node scripts/check-test-siblings.mjs <file> [file…]  # checks given files (for tests)
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Exempt: tests themselves, type decls, barrels, declaration-only registries, the
// shadcn primitives, test utils, and the Next.js special files that are framework
// glue rather than behaviour — `layout`, `loading`, `error`, `not-found`,
// `template`, `sitemap`, `robots`, and the metadata image routes. Those are
// exercised by the e2e suite and by rendering, not in isolation.
//
// Deliberately NOT exempt: `page.tsx`, `route.ts` and everything under
// `app/actions/`. In this repo a page is a real component (40-100 lines, not a
// thin re-export), and route handlers and server actions carry the boundary logic
// — `app/api/csp-report/route.test.ts` and `app/actions/example-form.test.ts`
// already set that precedent. Note that `vitest.config.ts` excludes `app/` from
// COVERAGE, which is a threshold decision, not a claim that app code is untestable.
//
// `types.ts` is exempt for the same reason as `constants.ts`: no runtime behaviour to
// assert. `app/dev/**` is exempt because it is dev tooling that `proxy.ts` answers
// 404 for in production — the sibling templates treat their own playground the same
// way.
const EXEMPT =
    /(\.test\.[tj]sx?$|\.d\.ts$|\/index\.tsx?$|constants\.ts$|\/_example[^/]*$|\/layout\.tsx$|\/loading\.tsx$|\/error\.tsx$|\/global-error\.tsx$|\/not-found\.tsx$|\/template\.tsx$|\/sitemap\.ts$|\/robots\.ts$|-image\.tsx$|^shared\/ui\/[^/]+\.tsx$|\/test-utils\/|types\.ts$|^app\/dev\/)/;

// Repo logic lives in these top-level layers (no `src/` in a Next App Router repo).
const isSrcLogic = (f) =>
    /^(app|features|entities|shared|i18n)\/.+\.(ts|tsx)$/.test(f) && !EXEMPT.test(f);

const argvFiles = process.argv.slice(2);
const files = argvFiles.length
    ? argvFiles
    : execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
          .split('\n')
          .filter(Boolean);

const missing = [];
for (const f of files) {
    if (!isSrcLogic(f)) continue;
    const base = f.replace(/\.(ts|tsx)$/, '');
    if (!existsSync(`${base}.test.ts`) && !existsSync(`${base}.test.tsx`)) {
        missing.push(f);
    }
}

if (missing.length) {
    console.error('\n✖ TDD-gate: staged source files with no co-located *.test.* sibling:');
    for (const m of missing) {
        const ext = m.endsWith('.tsx') ? 'tsx' : 'ts';
        console.error(`  - ${m}  → add ${m.replace(/\.(ts|tsx)$/, `.test.${ext}`)}`);
    }
    console.error(
        '\nTests must exist alongside source. Add the test, or if genuinely exempt extend EXEMPT in scripts/check-test-siblings.mjs.\n'
    );
    process.exit(1);
}
