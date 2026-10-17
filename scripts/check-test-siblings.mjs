#!/usr/bin/env node
// TDD-gate (deterministic): every src LOGIC file must have a co-located *.test.*
// sibling. Enforces "tests EXIST" — not "tests-first" (ordering can't be
// hook-forced; that stays an advisory practice). Exit 1 on a missing sibling so a
// model that skips tests cannot land untested logic.
//
// Where it looks matters as much as what it checks:
//   - staged mode reads the git INDEX, not the disk: a sibling test that exists only as an
//     untracked file is not part of the commit, so it does not count.
//   - range mode is the same rule over a pull request: every source file the range adds or
//     changes needs a sibling tracked at head. It runs inside `verify` and `verify:scaffold`, so
//     CI and the push in either phase reach it, because a hook can be skipped and a commit made
//     elsewhere never passed one.
//
// Usage:
//   node scripts/check-test-siblings.mjs                 # staged files, siblings from the index (pre-commit)
//   node scripts/check-test-siblings.mjs --range [--base <ref>] [--head <ref>]
//                                                        # base...head, siblings from head (CI, push)
//   node scripts/check-test-siblings.mjs <file> [file…]  # given files, siblings from the disk (for tests)
// Range base: --base, else HEAD~1 when CI is set (a pull request's merge commit has the base tip
// as its first parent; the checkout needs fetch-depth 2), else the merge-base of HEAD with
// origin/master or origin/main. No base commit at all passes with a note; a shallow clone that
// hides the parent fails, because passing there would be a silent skip.
// Exit codes: 0 clear, 1 a source file without a sibling, 2 the check could not run.
import { execFileSync } from 'node:child_process';
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
// — `app/api/csp-report/route.test.ts` and the example Server Action's test
// already set that precedent. Note that `vitest.config.ts` excludes `app/` from
// COVERAGE, which is a threshold decision, not a claim that app code is untestable.
//
// `types.ts` is exempt for the same reason as `constants.ts`: no runtime behaviour to
// assert. `app/dev/**` is exempt because it is dev tooling that `proxy.ts` answers
// 404 for in production — the sibling templates treat their own playground the same
// way.
const EXEMPT =
    /(\.test\.[tj]sx?$|\.d\.ts$|\/index\.ts$|constants\.ts$|\/_example[^/]*$|\/layout\.tsx$|\/loading\.tsx$|\/error\.tsx$|\/global-error\.tsx$|\/not-found\.tsx$|\/template\.tsx$|\/sitemap\.ts$|\/robots\.ts$|-image\.tsx$|^shared\/ui\/[^/]+\.tsx$|\/test-utils\/|types\.ts$|^app\/dev\/)/;

// Repo logic lives in these top-level layers (no `src/` in a Next App Router repo).
export const isSrcLogic = (file) =>
    /^(app|features|entities|shared|i18n)\/.+\.(ts|tsx)$/.test(file) && !EXEMPT.test(file);

/**
 * Pure decision half, so the EXEMPT list can be tested without a git index or a
 * real tree. `exists` is injected for the same reason: this is the piece most
 * likely to be edited later (usually to widen an exemption), so it is the piece
 * that needs a spec.
 */
/**
 * Every path that would count as this file's test. `Dir/index.tsx` is a component here, not a barrel
 * (the barrels are `index.ts`), and its test is named after the DIRECTORY — the convention the existing
 * components already follow. Exported so the naming rules are testable on their own.
 */
export const siblingCandidates = (file) => {
    const base = file.replace(/\.(ts|tsx)$/, '');
    const candidates = [`${base}.test.ts`, `${base}.test.tsx`];

    const componentDirectory = /^(.*)\/index\.tsx$/.exec(file)?.[1];
    if (componentDirectory) {
        const name = componentDirectory.split('/').at(-1);
        candidates.push(
            `${componentDirectory}/${name}.test.tsx`,
            `${componentDirectory}/${name}.test.ts`
        );
    }

    return candidates;
};

export const findMissingSiblings = (files, exists) =>
    files.filter(
        (file) => isSrcLogic(file) && !siblingCandidates(file).some((path) => exists(path))
    );

/* ------------------------------------------------------------------------ git */

// Child git calls start from the cwd repository: a hook exports where ITS repository is, and a
// check that inherited that would answer for the wrong tree. GIT_INDEX_FILE is deliberately kept,
// because it names the index the commit is being built from (`git commit <path>` and `-a` use a
// temporary one), and that is exactly what staged mode must read.
const GIT_LOCATION_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR'];

const gitEnvironment = () => {
    const env = { ...process.env };
    for (const key of GIT_LOCATION_VARIABLES) delete env[key];
    return env;
};

const git = (args) =>
    execFileSync('git', args, {
        encoding: 'utf8',
        env: gitEnvironment(),
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe']
    });

// stdout, or null when the command fails (a missing ref is an answer here, not an error).
const tryGit = (args) => {
    try {
        return git(args).trim();
    } catch {
        return null;
    }
};

// NUL-separated output: a path with a space or a non-ASCII character is not quoted by git.
const paths = (args) =>
    git([...args, '-z'])
        .split('\0')
        .filter(Boolean);

const BASE_CANDIDATES = ['origin/master', 'origin/main'];

const isCi = (env) => env.CI === 'true' || env.GITHUB_ACTIONS === 'true';

const isCommit = (ref) => tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null;

/** { ref } to compare with, { root: true } when there is no earlier commit, or { error }. */
export const resolveBase = ({ baseRef, env }) => {
    let ref = null;
    if (baseRef) {
        if (!isCommit(baseRef))
            return { error: `--base ${baseRef} is not a commit in this repository` };
        ref = baseRef;
    } else if (isCi(env)) {
        ref = isCommit('HEAD~1') ? 'HEAD~1' : null;
    } else {
        for (const candidate of BASE_CANDIDATES) {
            const mergeBase = tryGit(['merge-base', 'HEAD', candidate]);
            if (mergeBase && isCommit(mergeBase)) {
                ref = mergeBase;
                break;
            }
        }
        if (!ref && isCommit('HEAD~1')) ref = 'HEAD~1';
    }

    if (ref) return { ref };
    if (tryGit(['rev-parse', '--is-shallow-repository']) === 'true') {
        return {
            error: 'shallow clone with no parent commit to compare with: check out with `fetch-depth: 2` (actions/checkout) or run `git fetch --deepen=1`'
        };
    }
    return { root: true };
};

/* ------------------------------------------------------------------------ arguments */

/** { files, range, base, head } or { error }. */
export const parseArguments = (argv) => {
    const parsed = { files: [], range: false, base: null, head: null };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--range') {
            parsed.range = true;
        } else if (argument === '--base' || argument === '--head') {
            const value = argv[index + 1];
            if (!value || value.startsWith('--')) return { error: `${argument} needs a value` };
            parsed[argument.slice(2)] = value;
            parsed.range = true;
            index += 1;
        } else if (argument.startsWith('--')) {
            return { error: `unknown option ${argument}` };
        } else {
            parsed.files.push(argument);
        }
    }
    if (parsed.range && parsed.files.length > 0) {
        return { error: 'give either files or a range, not both' };
    }
    return parsed;
};

/* ------------------------------------------------------------------------ main */

const fail = (message) => {
    console.error(`\n✖ TDD-gate: ${message}\n`);
    process.exit(2);
};

const report = (missing, scope) => {
    console.error(`\n✖ TDD-gate: ${scope} source files with no co-located *.test.* sibling:`);
    for (const file of missing) {
        const ext = file.endsWith('.tsx') ? 'tsx' : 'ts';
        console.error(`  - ${file}  → add ${file.replace(/\.(ts|tsx)$/, `.test.${ext}`)}`);
    }
    console.error(
        '\nTests must exist alongside source. Add the test, or if genuinely exempt extend EXEMPT in scripts/check-test-siblings.mjs.\n'
    );
    process.exit(1);
};

const checkStaged = () => {
    // The index is the truth: a sibling that is only on disk is not in the commit.
    const tracked = new Set(paths(['ls-files']));
    const staged = paths(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
    const missing = findMissingSiblings(staged, (file) => tracked.has(file));
    if (missing.length > 0) {
        report(missing, 'staged');
    }
};

const checkRange = ({ base: baseRef, head: headRef }) => {
    const head = headRef ?? 'HEAD';
    if (!isCommit(head)) fail(`--head ${head} is not a commit in this repository`);

    const base = resolveBase({ baseRef, env: process.env });
    if (base.error) fail(base.error);
    if (base.root) {
        console.log(
            'TDD-gate: no base commit to compare with (first commit of the repository), nothing to check.'
        );
        return;
    }

    const changed = paths(['diff', '--name-only', '--diff-filter=ACMR', `${base.ref}...${head}`]);
    const tracked = new Set(paths(['ls-tree', '-r', '--name-only', head]));
    const missing = findMissingSiblings(changed, (file) => tracked.has(file));
    if (missing.length > 0) {
        report(missing, `${base.ref}...${head}`);
    }
};

const main = () => {
    const parsed = parseArguments(process.argv.slice(2));
    if (parsed.error) fail(parsed.error);

    try {
        if (parsed.files.length > 0) {
            const missing = findMissingSiblings(parsed.files, existsSync);
            if (missing.length > 0) report(missing, 'given');
        } else if (parsed.range) {
            checkRange(parsed);
        } else {
            checkStaged();
        }
    } catch (error) {
        const detail = String(error.stderr ?? error.message).trim();
        fail(`could not read git state (${detail}). A check that cannot look has not passed.`);
    }
};

// Guarded so importing this module for a test does not shell out to git.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
