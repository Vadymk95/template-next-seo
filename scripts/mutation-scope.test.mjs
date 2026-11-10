import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Guards the mirror between the two lists that describe ONE scope: `mutate` in
// `stryker.config.json` (an include-list) and `coverage.exclude` in `vitest.config.ts` (an
// exclude-list). The mutation ADR's contract is "scope mirrors the coverage scope": mutation must
// include exactly the production layers coverage measures, and must never reach a directory
// coverage excludes. Nothing ties the two files together, and a second list describing the same
// scope always drifts — here neither list can be derived from the other (two tools, inverted
// shapes), so the tie is this suite instead.
//
// `vitest.config.ts` is deliberately parsed as TEXT, not imported: importing it would pull the
// config and its plugins into the instrumented module graph and change the very coverage report
// whose scope it defines.

// Repo-root-relative on purpose: vitest runs workers with the project root as cwd, both here and
// inside the Stryker sandbox copy. (`import.meta.url` is rewritten by vitest's transform and does
// not point back at this file.)
const repoFile = (relative) => readFileSync(resolve(relative), 'utf8');

// The FSD code-layer universe this repo already recognises elsewhere (`check-test-siblings.mjs`,
// the complexity ratchet). `entities/` is intentionally absent in the baseline scaffold, so the
// universe is filtered by what exists on disk — the day a layer appears, it must enter exactly one
// of the two lists, and this suite says which.
const FSD_LAYERS = ['app', 'features', 'entities', 'shared', 'i18n'];

const layersOnDisk = FSD_LAYERS.filter((layer) => existsSync(resolve(layer)));

const mutate = JSON.parse(repoFile('stryker.config.json')).mutate ?? [];

const coverageExcludeSource = /coverage:\s*\{[\s\S]*?exclude:\s*\[([\s\S]*?)\]/.exec(
    repoFile('vitest.config.ts')
)?.[1];
const coverageExclude = [...(coverageExcludeSource ?? '').matchAll(/['"]([^'"]+)['"]/g)].map(
    (match) => match[1]
);
const coverageExcludedDirs = coverageExclude.map((entry) => entry.replace(/\/(\*\*)?$/, ''));

const includes = mutate.filter((glob) => !glob.startsWith('!'));
const negations = mutate.filter((glob) => glob.startsWith('!'));
const topDir = (glob) => glob.split('/')[0];

const mutatedLayers = [...new Set(includes.map(topDir))];
const coverageMeasuredLayers = layersOnDisk.filter(
    (layer) => !coverageExcludedDirs.includes(layer)
);

describe('mutation scope mirrors the coverage scope', () => {
    it('parses both scope lists, fail-closed', () => {
        // An unparseable list must fail HERE, not let the mirror checks below pass vacuously
        // over an empty array.
        expect(includes.length, 'no include globs in stryker.config.json `mutate`').toBeGreaterThan(
            0
        );
        expect(
            coverageExclude.length,
            'could not parse `coverage.exclude` out of vitest.config.ts — update the extraction in this test'
        ).toBeGreaterThan(0);
    });

    it('no mutate include reaches a directory coverage excludes', () => {
        const offenders = includes.filter((glob) => coverageExcludedDirs.includes(topDir(glob)));

        expect(
            offenders,
            `stryker \`mutate\` includes [${offenders.join(', ')}], but vitest \`coverage.exclude\` excludes that directory — the two lists describe one scope and must agree`
        ).toEqual([]);
    });

    it('mutation covers every production layer coverage measures', () => {
        const missing = coverageMeasuredLayers.filter((layer) => !mutatedLayers.includes(layer));

        expect(
            missing,
            `coverage measures [${missing.join(', ')}] but stryker \`mutate\` does not include it — add "<layer>/**/*.{ts,tsx}" to \`mutate\`, or exclude the layer from coverage in vitest.config.ts`
        ).toEqual([]);
    });

    it('mutation reaches no layer beyond what coverage measures', () => {
        const extra = mutatedLayers.filter((layer) => !coverageMeasuredLayers.includes(layer));

        expect(
            extra,
            `stryker \`mutate\` includes [${extra.join(', ')}], which is not a production layer coverage measures — mutants there score against tests that never see the code`
        ).toEqual([]);
    });

    it('keeps the negations that hold tests and declarations out of the mutation scope', () => {
        for (const required of [
            '!**/*.test.*',
            '!**/*.spec.*',
            '!shared/lib/test-utils/**',
            '!**/*.d.ts'
        ]) {
            expect(negations, `stryker \`mutate\` must keep "${required}"`).toContain(required);
        }
    });
});

// The suite is one thing under two runners, and a native addon tells them apart. `next.config.ts`
// imports `next-intl/plugin`, which loads the `@parcel/watcher` addon, and two test files import
// `next.config.ts` (`next.config.test.ts`, `shared/lib/logger.test.ts`). On Linux the addon loads in
// one worker thread and fails with "Module did not self-register" in the next one. `vitest run` uses
// the `forks` pool (a process per test file), while Stryker's vitest runner defaults to `threads`,
// so the same file passed the gate and failed the weekly job. Stryker 10.0 hid it - a test file that
// fails to load counted as no tests at all - and 10.1 reports it, which turned the dry run red.
// Naming the pool keeps both runners on one execution model; the vitest default is `forks`
// (https://vitest.dev/config/pool).
describe('mutation runs the suite in the pool `vitest run` uses', () => {
    const STRYKER_DEFAULT_POOL = 'threads';
    const VITEST_DEFAULT_POOL = 'forks';

    const strykerPool =
        JSON.parse(repoFile('stryker.config.json')).vitest?.pool ?? STRYKER_DEFAULT_POOL;
    const vitestPool =
        /\bpool:\s*['"](\w+)['"]/.exec(repoFile('vitest.config.ts'))?.[1] ?? VITEST_DEFAULT_POOL;

    it('names the same pool as vitest.config.ts, or the vitest default when that names none', () => {
        expect(
            strykerPool,
            `stryker \`vitest.pool\` is "${strykerPool}" but \`vitest run\` uses "${vitestPool}" - a native addon that loads in one process fails in a second worker thread, so set "vitest": { "pool": "${vitestPool}" } in stryker.config.json`
        ).toBe(vitestPool);
    });
});

// A Stryker run that fails (a red dry run, a crash) leaves its sandbox behind: a full second copy of the
// repository, instrumented. `include` in `vitest.config.ts` is a wildcard, so `vitest run` collected the
// copy's test files as if they were ours; the sandbox is already out of git, prettier and ESLint.
describe('vitest leaves the Stryker sandbox out of the suite', () => {
    const tempDirName = JSON.parse(repoFile('stryker.config.json')).tempDirName ?? '.stryker-tmp';
    const testExcludeSource = /^ {8}exclude:\s*\[([\s\S]*?)^ {8}\]/m.exec(
        repoFile('vitest.config.ts')
    )?.[1];
    const testExclude = [
        ...(testExcludeSource ?? '').replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)
    ].map((match) => match[1]);

    it('parses `test.exclude`, fail-closed', () => {
        expect(
            testExclude.length,
            'could not parse `test.exclude` out of vitest.config.ts - update the extraction in this test'
        ).toBeGreaterThan(0);
    });

    it('excludes the directory `tempDirName` names', () => {
        expect(
            testExclude,
            `vitest \`test.exclude\` must list "**/${tempDirName}/**" - a failed Stryker run leaves that directory behind and \`vitest run\` would collect the copy`
        ).toContain(`**/${tempDirName}/**`);
    });
});
