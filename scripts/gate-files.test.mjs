// The manifest decides which changes need a human read (scripts/check-gate-integrity.mjs), so a gap
// in it is a gate a change can weaken unseen. The shared check tests its own logic against a fixture
// manifest; this file pins THIS repository's manifest to the files this repository really has: every
// gate script, hook, workflow, rule file and config is covered, and no entry has gone stale because
// the file it named was renamed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MANIFEST_PATH, matchesGlob, validateManifest } from './check-gate-integrity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Tracked and not-yet-tracked files, so a new gate file is judged before it is staged. */
const repositoryFiles = () => {
    const env = { ...process.env };
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR']) delete env[key];
    return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
        cwd: ROOT,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024
    })
        .split('\0')
        .filter((file) => file !== '');
};

const readManifest = () => JSON.parse(readFileSync(path.join(ROOT, MANIFEST_PATH), 'utf8'));

/** Configs that decide what the gate accepts, named so a rename shows up here and not in review. */
const GATE_CONFIGS = [
    'AGENTS.md',
    'CLAUDE.md',
    '.claude/settings.json',
    '.editorconfig',
    '.npmrc',
    '.nvmrc',
    '.oxlintrc.json',
    '.prettierignore',
    '.prettierrc.json',
    'commitlint.config.mjs',
    'eslint.config.js',
    'playwright.config.ts',
    'playwright.dev.config.ts',
    'shared/lib/test-utils/setup.ts',
    'stryker.config.json',
    'tsconfig.json',
    'vitest.config.ts'
];

describe('the gate manifest', () => {
    const files = repositoryFiles();
    const manifest = readManifest();
    const covered = (file) => manifest.paths.some((glob) => matchesGlob(glob, file));

    it('is a manifest the shared check accepts, and lists itself', () => {
        expect(validateManifest(manifest).error).toBeUndefined();
        expect(covered(MANIFEST_PATH)).toBe(true);
    });

    it('also watches the package.json overrides, which are security floors', () => {
        expect(manifest.packageKeys).toContain('overrides');
    });

    it('covers every script, hook, workflow and rule file the repository ships', () => {
        const gateFiles = files.filter(
            (file) =>
                file.startsWith('scripts/') ||
                (file.startsWith('.husky/') && !file.startsWith('.husky/_/')) ||
                file.startsWith('.github/') ||
                file.startsWith('.cursor/rules/')
        );

        expect(gateFiles.length).toBeGreaterThan(40);
        expect(gateFiles.filter((file) => !covered(file))).toEqual([]);
    });

    it('covers each lint, type, test, e2e and coverage config, the tsconfig files and the agent docs', () => {
        const tsconfigs = files.filter((file) => /^tsconfig[^/]*\.json$/.test(file));

        expect(tsconfigs).toContain('tsconfig.json');
        expect([...GATE_CONFIGS, ...tsconfigs].filter((file) => !covered(file))).toEqual([]);
    });

    it('names no config that is gone, so a rename cannot leave a silent gap', () => {
        expect(GATE_CONFIGS.filter((file) => !files.includes(file))).toEqual([]);
    });

    it('has no entry that matches nothing', () => {
        expect(
            manifest.paths.filter((glob) => !files.some((file) => matchesGlob(glob, file)))
        ).toEqual([]);
    });
});
