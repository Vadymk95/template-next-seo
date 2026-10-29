// @vitest-environment node
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync
} from 'node:fs';
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
 * in a test, a spec, a script, a doc page or a comment becomes CSS that no page uses.
 * `app/globals.css` turns the automatic scan off, names the folders that hold markup with
 * `@source`, and keeps the tests and specs inside them out with one `@source not` line. This test
 * pins that: what the lines leave out must not ship, what they name must, every named folder must
 * exist, and a top-level folder of the repo that holds markup files must be named, listed as not
 * rendered from, or ignored by git.
 *
 * The compile tests run the real stylesheet text through the real PostCSS plugin (the one
 * `postcss.config.mjs` names) over a throwaway project that mirrors the repo's layout, so they need
 * no Next build and do not depend on what the repo's own files happen to contain. Every file holds
 * one class whose label names the file, so a leaked rule says which file leaked it.
 */

interface Fixture {
    file: string;
    label: string;
}

/** App source files: what they use MUST ship, or the allowlist has left out real code. */
const APP_SOURCES: Fixture[] = [
    { file: 'app/layout.tsx', label: 'app-layout' },
    { file: 'app/[locale]/page.tsx', label: 'app-locale-page' },
    { file: 'shared/ui/card.tsx', label: 'shared-ui' },
    // Named like a config file, but inside a scanned folder: it is app code.
    { file: 'shared/lib/site.config.ts', label: 'nested-config' },
    { file: 'features/demo/ui/panel.tsx', label: 'features-ui' },
    // App copy: it stays scanned, so a message that carries a class still ships it.
    { file: 'messages/en.json', label: 'messages-json' }
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
    { file: '.claude/settings.json', label: 'claude-dir' },
    // A folder no line names: a fork's new folder is not scanned until a line names it.
    { file: 'newfolder/x.tsx', label: 'unlisted-dir' }
];

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const STYLESHEET_DIR = path.join(REPO_ROOT, 'app');
const STYLESHEET = readFileSync(path.join(STYLESHEET_DIR, 'globals.css'), 'utf8');

/** The folders the stylesheet names with `@source`, as written (`../app`); `@source not` is no root. */
const SOURCE_ROOTS = STYLESHEET.split('\n').flatMap((line) => {
    const root = /^@source\s+'([^']+)';$/.exec(line)?.[1];
    return root === undefined ? [] : [root];
});

/** The top-level folder of the repo that a root points into. */
const topFolder = (root: string): string =>
    path.relative(REPO_ROOT, path.resolve(STYLESHEET_DIR, root)).split(path.sep)[0] ?? '';

/** Top-level folders that no page renders from, whatever they hold, so no `@source` line names them. */
const NO_MARKUP = ['.claude', '.cursor', '.git', '.github', '.husky', 'e2e', 'scripts'];

/**
 * A file that holds markup, so a class in it can ship. Code without markup (`.ts`, `.mjs`) and data
 * do not make a folder a candidate: a folder of hooks or helpers needs no line, and a class a
 * `.ts` file holds shows up as a missing style in the browser.
 */
const MARKUP_FILE = /\.(?:tsx|jsx|html|mdx|vue|svelte)$/;

/** The plain names `.gitignore` lists. The scanner skips what git ignores, so no line names it. */
const gitIgnoredNames = (): string[] =>
    readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8')
        .split('\n')
        .map((line) => line.trim().replace(/^\//, '').replace(/\/$/, ''))
        .filter((name) => /^[\w.-]+$/.test(name));

/** Top-level folders that hold markup files and are neither named by a line nor listed above. */
const unclaimedMarkupFolders = (): string[] => {
    const claimed = new Set([...SOURCE_ROOTS.map(topFolder), ...NO_MARKUP, ...gitIgnoredNames()]);

    return readdirSync(REPO_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !claimed.has(entry.name))
        .map((entry) => entry.name)
        .filter((name) =>
            readdirSync(path.join(REPO_ROOT, name), { encoding: 'utf8', recursive: true }).some(
                (file) => MARKUP_FILE.test(file)
            )
        );
};

let project = '';
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
    project = mkdtempSync(path.join(tmpdir(), 'globals-sources-'));
    for (const fixture of [...APP_SOURCES, ...NON_APP_FILES]) writeFixture(project, fixture);
    // Link the repo's node_modules so `@import 'tailwindcss'` resolves inside the project.
    symlinkSync(
        path.join(REPO_ROOT, 'node_modules'),
        path.join(project, 'node_modules'),
        'junction'
    );

    unprotectedCss = await compile(project, "@import 'tailwindcss';", 'unprotected.css');
    appCss = await compile(project, STYLESHEET, 'globals.css');
});

afterAll(() => {
    if (project) rmSync(project, { recursive: true, force: true });
});

/** The fixture files whose class made it into `css`. Names files, so a failure stays short. */
const shippedBy = (css: string, fixtures: Fixture[]): string[] =>
    fixtures.filter(({ label }) => css.includes(`sentinel-${label}`)).map(({ file }) => file);

const files = (fixtures: Fixture[]): string[] => fixtures.map(({ file }) => file);

describe('app/globals.css scan sources', () => {
    it('ships no utility that only a file outside the named folders, or a test inside them, mentions', () => {
        expect(shippedBy(appCss, NON_APP_FILES)).toEqual([]);
    });

    it('still ships the utilities that app source files use', () => {
        expect(shippedBy(appCss, APP_SOURCES)).toEqual(files(APP_SOURCES));
    });

    // The control: a file the scanner never reads would pass the first test proving nothing.
    it('would ship every one of those files without the allowlist', () => {
        expect(shippedBy(unprotectedCss, NON_APP_FILES)).toEqual(files(NON_APP_FILES));
    });

    // Each line has to be what ships its folder: a folder no fixture lives in, or one that a
    // neighbouring line or a leftover automatic scan also reaches, would pass the tests above.
    it.each(SOURCE_ROOTS)('stops shipping the folder %s once its line is removed', async (root) => {
        const inside = APP_SOURCES.filter(({ file }) => file.startsWith(`${topFolder(root)}/`));
        const without = STYLESHEET.replace(`@source '${root}';\n`, '');

        expect(
            inside,
            `add an APP_SOURCES fixture under ${topFolder(root)}/ in app/globals.test.ts`
        ).not.toEqual([]);
        expect(shippedBy(await compile(project, without, 'globals.css'), inside)).toEqual([]);
    });
});

describe('app/globals.css source folders', () => {
    it('names at least one folder', () => {
        expect(SOURCE_ROOTS).not.toEqual([]);
    });

    // A renamed folder would otherwise stop being scanned with no failing test: the compile tests
    // above use fixture folders, not the repo's own.
    it('names only folders that exist', () => {
        const missing = SOURCE_ROOTS.filter(
            (root) => !existsSync(path.resolve(STYLESHEET_DIR, root))
        );

        expect(missing).toEqual([]);
    });

    it('leaves no top-level folder with markup files unnamed unless it is listed as not rendered', () => {
        expect(
            unclaimedMarkupFolders(),
            'name the folder with an @source line in app/globals.css, or add it to NO_MARKUP'
        ).toEqual([]);
    });
});
