// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import tailwindcss from '@tailwindcss/postcss';

import postcss from 'postcss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Vitest swaps a CSS import (`?raw` too) for an empty module, so the text is read with fs below.
// This import only puts the stylesheet in the module graph: `vitest run --changed` picks tests by
// what they import, and without the edge an edit to the stylesheet alone would select nothing.
import './globals.css';

/*
 * Tailwind ships a rule for every class-shaped string in every file it scans, so a class quoted
 * in a test, a spec, a script, a doc page or a comment becomes CSS that no page uses. The
 * `@source not` lines in `app/globals.css` keep those files out of the scan; this test pins them.
 *
 * It compiles the real stylesheet text with the real PostCSS plugin (the one `postcss.config.mjs`
 * names) over a throwaway project that mirrors the repo's layout, so it needs no Next build and
 * does not depend on what the repo's own files happen to contain. Every file holds one class whose
 * label names the file, so a leaked rule says which file leaked it.
 */

interface Fixture {
    file: string;
    label: string;
}

/** App source files: what they use MUST ship, or an exclusion has swallowed real code. */
const APP_SOURCES: Fixture[] = [
    { file: 'app/layout.tsx', label: 'app-layout' },
    { file: 'app/[locale]/page.tsx', label: 'app-locale-page' },
    { file: 'shared/ui/card.tsx', label: 'shared-ui' },
    // Named like a root config file, but nested: the config line must not reach it.
    { file: 'shared/lib/site.config.ts', label: 'nested-config' },
    { file: 'features/demo/ui/panel.tsx', label: 'features-ui' }
];

/** Files no page renders from: a class only they mention MUST NOT ship. */
const NON_APP_FILES: Fixture[] = [
    { file: 'app/[locale]/page.test.tsx', label: 'unit-test' },
    { file: 'shared/ui/card.spec.tsx', label: 'spec-file' },
    { file: 'e2e/support/helper.ts', label: 'e2e-dir' },
    { file: 'scripts/gate-tool.mjs', label: 'scripts-dir' },
    { file: 'eslint.config.js', label: 'root-config' },
    { file: 'README.md', label: 'markdown' },
    { file: 'docs/guide.mdx', label: 'mdx' },
    { file: '.cursor/rules/style.mdc', label: 'cursor-dir' },
    { file: '.github/workflows/ci.yml', label: 'github-dir' },
    { file: '.claude/settings.json', label: 'claude-dir' }
];

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

let project: string | undefined;
let unprotectedCss = '';
let appCss = '';

const writeFixture = (root: string, { file, label }: Fixture): void => {
    const target = path.join(root, file);
    const utility = `content-['sentinel-${label}']`;
    mkdirSync(path.dirname(target), { recursive: true });
    // Quoted both ways: in backticks, as a doc page or a comment quotes a class, and in double
    // quotes, the only form the scanner reads inside a JSON file.
    writeFileSync(target, `\`${utility}\`\n"${utility}"\n`);
};

const compile = async (root: string, stylesheet: string, name: string): Promise<string> => {
    // `optimize` follows NODE_ENV by default; pinned off so the output is the same everywhere.
    const plugin = tailwindcss({ base: root, optimize: false });
    const result = await postcss([plugin]).process(stylesheet, {
        from: path.join(root, 'app', name)
    });
    return result.css;
};

beforeAll(async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'globals-sources-'));
    project = root;
    for (const fixture of [...APP_SOURCES, ...NON_APP_FILES]) writeFixture(root, fixture);
    // Link the repo's node_modules so `@import 'tailwindcss'` resolves inside the project.
    symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'junction');

    unprotectedCss = await compile(root, "@import 'tailwindcss';", 'unprotected.css');
    appCss = await compile(
        root,
        readFileSync(path.join(REPO_ROOT, 'app/globals.css'), 'utf8'),
        'globals.css'
    );
});

afterAll(() => {
    if (project) rmSync(project, { recursive: true, force: true });
});

/** The fixture files whose class made it into `css`. Names files, so a failure stays short. */
const shippedBy = (css: string, fixtures: Fixture[]): string[] =>
    fixtures.filter(({ label }) => css.includes(`sentinel-${label}`)).map(({ file }) => file);

const files = (fixtures: Fixture[]): string[] => fixtures.map(({ file }) => file);

describe('app/globals.css scan sources', () => {
    it('ships no utility that only a test, spec, script, doc or tooling file mentions', () => {
        expect(shippedBy(appCss, NON_APP_FILES)).toEqual([]);
    });

    it('still ships the utilities that app source files use', () => {
        expect(shippedBy(appCss, APP_SOURCES)).toEqual(files(APP_SOURCES));
    });

    // The control: a file the scanner never reads would pass the first test proving nothing.
    it('would ship every one of those files without the exclusions', () => {
        expect(shippedBy(unprotectedCss, NON_APP_FILES)).toEqual(files(NON_APP_FILES));
    });
});
