// The EXEMPT list is the part of this gate people actually edit, and every edit
// widens it — usually to get one commit moving. These cases pin what the exemptions
// are FOR, so a widening that changes the policy fails here instead of silently
// letting untested logic land.
//
// This repo has no `src/`: logic lives in the top-level App Router layers, so the
// layer predicate itself is worth pinning too — a stray layer name added to it would
// silently pull unrelated files into the gate, and a missing one would drop a whole
// layer out of it.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    FALLBACK_BASE,
    findMissingSiblings,
    isCi,
    isSrcLogic,
    makeGit,
    resolveBase
} from './check-test-siblings.mjs';

const nothingExists = () => false;

describe('isSrcLogic', () => {
    it.each([
        'shared/lib/logger.ts',
        'shared/lib/rateLimitCore.ts',
        'features/example-form/model/schema.ts',
        'features/example-form/ui/ExampleForm.tsx',
        'app/actions/example-form.ts',
        'app/api/health/route.ts',
        'i18n/request-locale.ts'
    ])('treats %s as logic that needs a test', (file) => {
        expect(isSrcLogic(file)).toBe(true);
    });

    it.each([
        ['a test file', 'shared/lib/logger.test.ts'],
        ['a type declaration', 'global.d.ts'],
        ['a barrel', 'features/example-form/index.ts'],
        ['a constants table', 'shared/constants/constants.ts'],
        ['a types-only module', 'features/example-form/model/types.ts'],
        ['a template seed', 'shared/lib/api/_exampleQuery.ts'],
        // App Router conventional files: framework-shaped shells, not logic.
        ['a layout', 'app/[locale]/layout.tsx'],
        ['a loading state', 'app/[locale]/loading.tsx'],
        ['an error boundary', 'app/[locale]/error.tsx'],
        ['the root error boundary', 'app/global-error.tsx'],
        ['a not-found', 'app/[locale]/not-found.tsx'],
        ['a template', 'app/[locale]/template.tsx'],
        ['the sitemap', 'app/sitemap.ts'],
        ['robots', 'app/robots.ts'],
        ['an opengraph image', 'app/[locale]/opengraph-image.tsx'],
        // Presentational primitives directly under shared/ui.
        ['a shared/ui primitive', 'shared/ui/Button.tsx'],
        ['a test util', 'shared/lib/test-utils/render.tsx'],
        // The dev playground is gated out of production by `proxy.ts`.
        ['a dev playground route', 'app/dev/ui/page.tsx']
    ])('exempts %s', (_label, file) => {
        expect(isSrcLogic(file)).toBe(false);
    });

    it('only recognises the declared layers', () => {
        // Anything outside app / features / entities / shared / i18n is not this
        // gate's business — scripts, e2e specs and root config all live elsewhere.
        // These paths are `.ts` on purpose: an `.mjs` path is rejected by the
        // extension half of the predicate, so it could not catch a stray layer
        // name being added to the layer half.
        expect(isSrcLogic('scripts/seed.ts')).toBe(false);
        expect(isSrcLogic('e2e/fixtures/user.ts')).toBe(false);
        expect(isSrcLogic('tooling/codegen/run.ts')).toBe(false);
        expect(isSrcLogic('e2e/home.spec.ts')).toBe(false);
        expect(isSrcLogic('next.config.ts')).toBe(false);
        expect(isSrcLogic('proxy.ts')).toBe(false);
        expect(isSrcLogic('messages/en.json')).toBe(false);
    });

    it('requires a path INSIDE a layer, not the layer name alone', () => {
        expect(isSrcLogic('shared.ts')).toBe(false);
        expect(isSrcLogic('appointments/booking.ts')).toBe(false);
    });

    it('does not exempt a nested directory that reuses an exempt name', () => {
        // `^shared/ui/[^/]+\.tsx$` is deliberately one level deep: a component
        // nested further owns real composition and needs a test. `^app/dev/` is
        // anchored, so a feature's own `dev/` directory is ordinary code.
        expect(isSrcLogic('shared/ui/table/TableRow.tsx')).toBe(true);
        expect(isSrcLogic('features/editor/app/dev/Panel.tsx')).toBe(true);
    });

    it('does not exempt a filename that merely starts with an exempt name', () => {
        expect(isSrcLogic('shared/lib/constantsFactory.ts')).toBe(true);
        expect(isSrcLogic('features/example-form/model/typesGuard.ts')).toBe(true);
    });
});

describe('findMissingSiblings', () => {
    it('reports a logic file with no sibling', () => {
        expect(findMissingSiblings(['shared/lib/logger.ts'], nothingExists)).toEqual([
            'shared/lib/logger.ts'
        ]);
    });

    it('accepts either sibling extension', () => {
        expect(
            findMissingSiblings(['shared/lib/logger.ts'], (p) => p === 'shared/lib/logger.test.ts')
        ).toEqual([]);
        expect(
            findMissingSiblings(['features/example-form/ui/ExampleForm.tsx'], (p) =>
                p.endsWith('ExampleForm.test.tsx')
            )
        ).toEqual([]);
    });

    it('passes an empty change set', () => {
        expect(findMissingSiblings([], nothingExists)).toEqual([]);
    });

    it('never reports an exempt file, even with nothing on disk', () => {
        expect(findMissingSiblings(['app/[locale]/layout.tsx'], nothingExists)).toEqual([]);
    });

    it('reports every offender rather than stopping at the first', () => {
        expect(
            findMissingSiblings(
                ['shared/lib/a.ts', 'app/robots.ts', 'shared/lib/b.ts'],
                nothingExists
            )
        ).toEqual(['shared/lib/a.ts', 'shared/lib/b.ts']);
    });

    it('probes only paths derived from the file under test', () => {
        const probed = [];
        findMissingSiblings(['shared/lib/rateLimitCore.ts'], (path) => {
            probed.push(path);
            return false;
        });

        expect(probed).toEqual([
            'shared/lib/rateLimitCore.test.ts',
            'shared/lib/rateLimitCore.test.tsx'
        ]);
    });

    it('is not satisfied by a sibling belonging to a different module', () => {
        expect(findMissingSiblings(['shared/lib/a.ts'], (p) => p.includes('b.test'))).toEqual([
            'shared/lib/a.ts'
        ]);
    });
});

/* ------------------------------------------------------------------------ the CLI, end to end */

// The decision above is pure; these cases run the real script against a real repository, because the
// two ways this gate used to be wrong are both about WHERE it looks: a sibling test left untracked on
// disk satisfied it although the commit would not contain it, and nothing at all ran it on a pull
// request, so an orphan source that skipped the hook landed anyway.
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-test-siblings.mjs');
const GIT_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'];

// A suite that runs inside a git hook inherits the hook's repository variables; every child starts clean.
const cleanEnv = (extra = {}) => {
    const env = { ...process.env, CI: '', GITHUB_ACTIONS: '' };
    for (const key of GIT_VARIABLES) delete env[key];
    return { ...env, ...extra };
};

const git = (cwd, args, env = cleanEnv()) =>
    execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: 'pipe' });

const SOURCE = 'shared/lib/logger.ts';
const SIBLING = 'shared/lib/logger.test.ts';

describe('the CLI against a real git repository', () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    const makeRepo = () => {
        const root = mkdtempSync(path.join(tmpdir(), 'siblings-'));
        roots.push(root);
        git(root, ['init', '--quiet', '--initial-branch=main']);
        git(root, ['config', 'user.email', 'gate@example.invalid']);
        git(root, ['config', 'user.name', 'gate']);
        git(root, ['config', 'commit.gpgsign', 'false']);
        return root;
    };

    const write = (root, file, text = 'export const value = 1;\n') => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
    };

    const commit = (root, message) => {
        git(root, ['add', '-A']);
        git(root, ['commit', '--quiet', '--no-verify', '-m', message]);
    };

    // A repository whose first commit holds a README only, so every case adds its own files.
    const baseline = () => {
        const root = makeRepo();
        write(root, 'README.md', '# fixture\n');
        commit(root, 'baseline');
        return root;
    };

    const run = (cwd, args = [], env = cleanEnv()) => {
        const result = spawnSync('node', [SCRIPT, ...args], { cwd, env, encoding: 'utf8' });
        return { code: result.status, output: `${result.stdout}${result.stderr}` };
    };

    describe('staged mode (no arguments)', () => {
        it('fails when the sibling test sits on disk but is not in the index', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', SOURCE]);

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        it('passes when the source and its sibling are staged together', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', SOURCE, SIBLING]);

            expect(run(root).code).toBe(0);
        });

        it('passes when the sibling was committed earlier and only the source changes', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            commit(root, 'logic with its test');
            write(root, SOURCE, 'export const value = 2;\n');
            git(root, ['add', SOURCE]);

            expect(run(root).code).toBe(0);
        });

        it('fails when the sibling was removed from the index but left on disk', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            commit(root, 'logic with its test');
            write(root, SOURCE, 'export const value = 2;\n');
            git(root, ['add', SOURCE]);
            git(root, ['rm', '--cached', '--quiet', SIBLING]);

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        // `git add -N` puts the path in the index (ls-files prints it) but stages no content, so the
        // commit leaves the sibling out.
        it('fails when the sibling is only an intent-to-add entry', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', SOURCE]);
            git(root, ['add', '--intent-to-add', SIBLING]);

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        it('fails for an intent-to-add sibling even when a deleted file looks like its rename source', () => {
            const root = baseline();
            const identical = 'export const unrelated = 1;\n';
            write(root, 'shared/lib/unrelated.test.ts', identical);
            commit(root, 'an earlier test');
            rmSync(path.join(root, 'shared/lib/unrelated.test.ts'));
            write(root, SOURCE);
            write(root, SIBLING, identical);
            git(root, ['add', SOURCE]);
            git(root, ['add', '--intent-to-add', SIBLING]);

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        it('passes once an intent-to-add sibling is staged for real', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', '--intent-to-add', SIBLING]);
            git(root, ['add', SOURCE, SIBLING]);

            expect(run(root).code).toBe(0);
        });

        it('fails when the sibling is intent-to-add and then deleted from the disk', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', SOURCE]);
            git(root, ['add', '--intent-to-add', SIBLING]);
            rmSync(path.join(root, SIBLING));

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        // HEAD holds the spec and `ls-files` lists it again, yet the staged diff reports it deleted: the
        // commit removes it, so it is no sibling.
        it('fails when a committed sibling was removed from the index and re-marked with intent-to-add', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            commit(root, 'logic with its test');
            write(root, SOURCE, 'export const value = 2;\n');
            git(root, ['add', SOURCE]);
            git(root, ['rm', '--cached', '--quiet', SIBLING]);
            git(root, ['add', '--intent-to-add', SIBLING]);

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        // A plain staged diff shows the move as `R`, so only a listing with rename detection off sees
        // the new path as an addition the commit carries.
        it('passes when the sibling arrives as a staged rename of a committed file', () => {
            const root = baseline();
            write(root, 'shared/lib/older.test.ts', 'export const older = 1;\n');
            commit(root, 'an earlier test');
            write(root, SOURCE);
            git(root, ['mv', 'shared/lib/older.test.ts', SIBLING]);
            git(root, ['add', SOURCE]);

            expect(run(root).code).toBe(0);
        });

        it('passes when the staged sibling was deleted from the working tree afterwards', () => {
            // The commit carries what the index holds, so the missing file on disk does not matter.
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', SOURCE, SIBLING]);
            rmSync(path.join(root, SIBLING));

            expect(run(root).code).toBe(0);
        });

        it('fails for a renamed source whose sibling stayed behind under the old name', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            commit(root, 'logic with its test');
            git(root, ['mv', SOURCE, 'shared/lib/renamed.ts']);

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/lib/renamed.ts');
        });

        it('reads the index the hook was given, not the default one', () => {
            // `git commit <path>` and `git commit -a` run the hook with GIT_INDEX_FILE pointing at a
            // temporary index; the default index is not what will be committed.
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', SIBLING]);
            const temporaryIndex = path.join(root, '.git', 'hook-index');
            const env = cleanEnv({ GIT_INDEX_FILE: temporaryIndex });
            git(root, ['read-tree', 'HEAD'], env);
            git(root, ['add', SOURCE], env);

            const verdict = run(root, [], env);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        it('answers for the working directory even when a hook exported another repository', () => {
            const root = baseline();
            write(root, SOURCE);
            git(root, ['add', SOURCE]);
            const other = baseline();

            const verdict = run(
                root,
                [],
                cleanEnv({ GIT_DIR: path.join(other, '.git'), GIT_WORK_TREE: other })
            );

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        it('fails loudly, never clear, when it is not inside a git repository', () => {
            const outside = mkdtempSync(path.join(tmpdir(), 'siblings-nogit-'));
            roots.push(outside);

            const verdict = run(
                outside,
                [],
                cleanEnv({ GIT_CEILING_DIRECTORIES: path.dirname(outside) })
            );

            expect(verdict.code).toBe(2);
            expect(verdict.output).toContain('git');
        });

        // A fork's first commit is the whole template, starter files with no sibling included, and
        // there is no earlier commit to compare with, so nothing is judged (range mode does the same).
        it('says so, and passes, on the first commit of a repository', () => {
            const root = makeRepo();
            write(root, SOURCE);
            git(root, ['add', '-A']);

            const verdict = run(root);

            expect(verdict.code).toBe(0);
            expect(verdict.output).toContain('the first commit');
        });

        it('judges the second commit again', () => {
            const root = makeRepo();
            write(root, SOURCE);
            commit(root, 'first');
            write(root, 'shared/lib/added.ts');
            git(root, ['add', '-A']);

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/lib/added.ts');
            expect(verdict.output).not.toContain(SOURCE);
        });
    });

    describe('range mode (--base / --range)', () => {
        const baseSha = (root) => git(root, ['rev-parse', 'HEAD']).trim();

        it('fails for an orphan source added in the range', () => {
            const root = baseline();
            const base = baseSha(root);
            write(root, 'shared/lib/orphan.ts');
            commit(root, 'orphan');

            const verdict = run(root, ['--base', base]);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/lib/orphan.ts');
        });

        it('passes when the range adds the source together with its sibling', () => {
            const root = baseline();
            const base = baseSha(root);
            write(root, SOURCE);
            write(root, SIBLING);
            commit(root, 'logic with its test');

            expect(run(root, ['--base', base]).code).toBe(0);
        });

        it('passes when the sibling arrives in a later commit of the same range', () => {
            const root = baseline();
            const base = baseSha(root);
            write(root, SOURCE);
            commit(root, 'logic');
            write(root, SIBLING);
            commit(root, 'its test');

            expect(run(root, ['--base', base]).code).toBe(0);
        });

        it('counts only the sibling tracked at head, not one left untracked on disk', () => {
            const root = baseline();
            const base = baseSha(root);
            write(root, SOURCE);
            commit(root, 'logic');
            write(root, SIBLING);

            const verdict = run(root, ['--base', base]);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        it('passes for a changed source whose sibling the base already tracked', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            commit(root, 'logic with its test');
            const base = baseSha(root);
            write(root, SOURCE, 'export const value = 2;\n');
            commit(root, 'edit');

            expect(run(root, ['--base', base]).code).toBe(0);
        });

        it('does not report a source the range deletes', () => {
            const root = baseline();
            write(root, SOURCE);
            commit(root, 'orphan from long ago');
            const base = baseSha(root);
            git(root, ['rm', '--quiet', SOURCE]);
            commit(root, 'delete it');

            expect(run(root, ['--base', base]).code).toBe(0);
        });

        it('judges --head, not the checked-out commit', () => {
            const root = baseline();
            const base = baseSha(root);
            write(root, 'shared/lib/orphan.ts');
            commit(root, 'orphan');
            const head = baseSha(root);
            git(root, ['reset', '--quiet', '--hard', base]);

            expect(run(root, ['--base', base]).code).toBe(0);
            expect(run(root, ['--base', base, '--head', head]).code).toBe(1);
        });

        it('rejects a base that is not a commit instead of passing', () => {
            const root = baseline();

            const verdict = run(root, ['--base', 'no-such-ref']);

            expect(verdict.code).toBe(2);
            expect(verdict.output).toContain('no-such-ref');
        });

        it('takes HEAD~1 as the base on CI', () => {
            const root = baseline();
            write(root, 'shared/lib/orphan.ts');
            commit(root, 'orphan');

            const verdict = run(root, ['--range'], cleanEnv({ CI: 'true' }));

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/lib/orphan.ts');
        });

        it('passes with a note when there is no earlier commit to compare with', () => {
            const root = makeRepo();
            write(root, SOURCE);
            commit(root, 'first');

            const verdict = run(root, ['--range'], cleanEnv({ CI: 'true' }));

            expect(verdict.code).toBe(0);
            expect(verdict.output).toContain('no base commit');
        });

        it('fails on a shallow clone that hides the parent, naming the fix', () => {
            const origin = baseline();
            write(origin, SOURCE);
            commit(origin, 'logic');
            const clone = mkdtempSync(path.join(tmpdir(), 'siblings-clone-'));
            roots.push(clone);
            git(origin, ['clone', '--quiet', '--depth', '1', `file://${origin}`, clone]);

            const verdict = run(clone, ['--range'], cleanEnv({ CI: 'true' }));

            expect(verdict.code).toBe(2);
            expect(verdict.output).toContain('fetch-depth');
        });
    });

    describe('arguments', () => {
        it('refuses a file list combined with a range', () => {
            const root = baseline();

            expect(run(root, ['--range', SOURCE]).code).toBe(2);
        });

        it('refuses an unknown flag instead of treating it as a file name', () => {
            const root = baseline();

            const verdict = run(root, ['--bse', 'HEAD']);

            expect(verdict.code).toBe(2);
            expect(verdict.output).toContain('--bse');
        });

        it('still checks the files it is given against the disk', () => {
            const root = baseline();
            write(root, SOURCE);

            expect(run(root, [SOURCE]).code).toBe(1);
            write(root, SIBLING);
            expect(run(root, [SOURCE]).code).toBe(0);
        });
    });

    // The iterate chain runs this mode: it judges the working tree against HEAD, so a missing test is
    // found before `git add`, not at the commit hook. A sibling counts when it is on disk, because at
    // this moment nothing is staged yet; the commit hook still wants it in the index.
    describe('changed mode (--changed)', () => {
        /** A repository whose HEAD holds a tested logic file and `legacy.ts`, a logic file with no test. */
        const withCommittedLogic = () => {
            const root = baseline();
            write(root, 'shared/lib/ok.ts');
            write(root, 'shared/lib/ok.test.ts');
            write(root, 'shared/lib/legacy.ts');
            commit(root, 'logic');
            return root;
        };

        it('passes on a clean tree, even when HEAD holds a file with no test', () => {
            expect(run(withCommittedLogic(), ['--changed']).code).toBe(0);
        });

        it('refuses an untracked logic file with no test and names the file and the remedy', () => {
            const root = baseline();
            write(root, SOURCE);

            const verdict = run(root, ['--changed']);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
            expect(verdict.output).toContain(`add ${SIBLING}`);
            expect(verdict.output).toContain('git add');
        });

        it('accepts an untracked logic file with an untracked test beside it', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);

            expect(run(root, ['--changed']).code).toBe(0);
        });

        it('refuses a staged-only logic file with no test', () => {
            const root = baseline();
            write(root, SOURCE);
            git(root, ['add', SOURCE]);

            const verdict = run(root, ['--changed']);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain(SOURCE);
        });

        it('accepts a staged logic file whose test is staged too', () => {
            const root = baseline();
            write(root, SOURCE);
            write(root, SIBLING);
            git(root, ['add', '-A']);

            expect(run(root, ['--changed']).code).toBe(0);
        });

        it('refuses an unstaged edit of a tracked logic file that has no test', () => {
            const root = withCommittedLogic();
            write(root, 'shared/lib/legacy.ts', 'export const changed = 1;\n');

            const verdict = run(root, ['--changed']);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/lib/legacy.ts');
        });

        it('accepts an unstaged edit of a tracked logic file whose test is committed', () => {
            const root = withCommittedLogic();
            write(root, 'shared/lib/ok.ts', 'export const changed = 1;\n');

            expect(run(root, ['--changed']).code).toBe(0);
        });

        it('applies the exempt list of the commit hook', () => {
            const root = baseline();
            write(root, 'shared/lib/constants.ts');
            write(root, 'features/example-form/index.ts');
            write(root, 'shared/ui/button.tsx');
            write(root, 'app/[locale]/layout.tsx');
            write(root, 'shared/lib/api/_exampleQuery.ts');

            expect(run(root, ['--changed']).code).toBe(0);
        });

        it('ignores a changed file outside the logic layers', () => {
            const root = baseline();
            write(root, 'scripts/tool.mjs');
            write(root, 'e2e/home.spec.ts');

            expect(run(root, ['--changed']).code).toBe(0);
        });

        it('does not judge a deleted logic file', () => {
            const root = withCommittedLogic();
            rmSync(path.join(root, 'shared/lib/legacy.ts'));

            expect(run(root, ['--changed']).code).toBe(0);
        });

        it('judges a renamed logic file at its new path', () => {
            const root = withCommittedLogic();
            git(root, ['mv', 'shared/lib/ok.ts', 'shared/lib/renamed.ts']);

            const verdict = run(root, ['--changed']);

            // `ok.test.ts` stayed behind: the old name had a test, the new one has none.
            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/lib/renamed.ts');
            expect(verdict.output).not.toContain('shared/lib/ok.ts');
        });

        it('accepts a renamed logic file that moved with its test', () => {
            const root = withCommittedLogic();
            git(root, ['mv', 'shared/lib/ok.ts', 'shared/lib/renamed.ts']);
            git(root, ['mv', 'shared/lib/ok.test.ts', 'shared/lib/renamed.test.ts']);

            expect(run(root, ['--changed']).code).toBe(0);
        });

        it('reports every offender, not only the first', () => {
            const root = baseline();
            write(root, 'shared/lib/a.ts');
            write(root, 'shared/lib/b.tsx');

            const verdict = run(root, ['--changed']);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/lib/a.ts');
            expect(verdict.output).toContain('shared/lib/b.tsx');
        });

        it('fails, rather than judging nothing, in a repository with no commit', () => {
            const root = makeRepo();
            write(root, SOURCE);

            const verdict = run(root, ['--changed']);

            expect(verdict.code).toBe(2);
            expect(verdict.output).toMatch(/no commit/);
        });

        it('refuses to combine with a range or with named files', () => {
            const root = baseline();

            for (const args of [
                ['--changed', '--range'],
                ['--changed', '--base', 'HEAD'],
                ['--changed', SOURCE]
            ]) {
                const verdict = run(root, args);

                expect(verdict.code, args.join(' ')).toBe(2);
                expect(verdict.output).toMatch(/cannot be combined/);
            }
        });
    });
});

describe('the base a caller can resolve with its own git', () => {
    // `makeGit` hands back stdout as git printed it, with its trailing newline; a stub that answers by command.
    const stubGit = (answers) => (args) => answers[args.join(' ')] ?? null;
    const VERIFY = (ref) => `rev-parse --verify --quiet ${ref}^{commit}`;

    it('takes the merge base with the remote branch, newline and all', () => {
        const git = stubGit({
            'merge-base HEAD origin/master': 'abc123\n',
            [VERIFY('abc123')]: 'abc123\n'
        });

        expect(resolveBase({ git, env: {} })).toEqual({ ref: 'abc123' });
    });

    it('falls back to the parent commit when no remote branch gives a merge base', () => {
        const git = stubGit({ [VERIFY(FALLBACK_BASE)]: 'def456\n' });

        expect(resolveBase({ git, env: {} })).toEqual({ ref: FALLBACK_BASE });
        expect(FALLBACK_BASE).toBe('HEAD~1');
    });

    it('asks the git it was given, not the process cwd, when a base is named', () => {
        const git = stubGit({ [VERIFY('main~3')]: 'aaa\n' });

        expect(resolveBase({ git, env: {}, baseRef: 'main~3' })).toEqual({ ref: 'main~3' });
        expect(resolveBase({ git, env: {}, baseRef: 'nope' })).toEqual({
            error: '--base nope is not a commit in this repository'
        });
    });

    it('recognises CI by either variable', () => {
        expect(isCi({ CI: 'true' })).toBe(true);
        expect(isCi({ GITHUB_ACTIONS: 'true' })).toBe(true);
        expect(isCi({ CI: '1' })).toBe(false);
        expect(isCi({})).toBe(false);
    });

    it('makeGit runs in the given folder and answers null for a failing command', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'siblings-makegit-'));
        try {
            const run = makeGit(root);

            expect(run(['rev-parse', '--is-inside-work-tree'])).toBe(null);
            git(root, ['init', '--quiet']);
            expect(run(['rev-parse', '--is-inside-work-tree'])).toBe('true\n');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
