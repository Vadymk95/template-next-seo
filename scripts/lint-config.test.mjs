// What the lint configuration promises and nothing else checks, against the real linters.
//
// The Tailwind rules read `app/globals.css` on their own, and ESLint's cache never looks at a file a
// rule opens itself. `eslint.config.js` therefore carries a fingerprint of the stylesheet in `settings`,
// which ESLint hashes into every cache entry. Two things hold that up and neither is visible in the
// config: the cache really does key on `settings` (the first block, against ESLint itself) and the real
// config really carries the fingerprint for the files the rules cover (the second block).
// `css-fingerprint.test.mjs` covers the hash. Then one rule option that must stay on, linted through
// the real config. The last block: both linters leave `.cursor/` alone, so an agent's scratch script
// there cannot red the iterate chain. And the commit hook: every tracked file the format check reads
// is matched by a `lint-staged` glob, so the hook formats what the push gate checks.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ESLint, Linter } from 'eslint';
import * as prettier from 'prettier';
import tseslint from 'typescript-eslint';
import { afterEach, describe, expect, it } from 'vitest';

import { cssFingerprint } from './css-fingerprint.mjs';

// Loading ESLint and, below, the whole repository config is the cost; the full suite runs these next to
// sixty other files, so the default 5 s limit measured machine load, not the code (10 s seen once).
describe('the ESLint cache and a stylesheet a rule reads', { timeout: 60_000 }, () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    // A rule whose verdict depends on a file it opens itself, as the Tailwind rules do.
    const stylesheetRule = (stylesheet) => ({
        meta: { name: 'probe', version: '1.0.0' },
        rules: {
            'reads-stylesheet': {
                meta: { schema: [] },
                create: (context) => ({
                    Program: (node) => {
                        const css = readFileSync(stylesheet, 'utf8');
                        if (css.includes('@utility')) context.report({ node, message: 'utility' });
                    }
                })
            }
        }
    });

    const setup = () => {
        const root = mkdtempSync(path.join(tmpdir(), 'eslint-css-'));
        roots.push(root);
        writeFileSync(path.join(root, 'a.js'), 'export const a = 1;\n');
        const stylesheet = path.join(root, 'globals.css');
        const lint = async (fingerprint) => {
            const eslint = new ESLint({
                cwd: root,
                cache: true,
                cacheLocation: path.join(root, '.eslintcache'),
                overrideConfigFile: true,
                overrideConfig: [
                    {
                        files: ['**/*.js'],
                        plugins: { probe: stylesheetRule(stylesheet) },
                        settings: { tailwindCssFingerprint: fingerprint },
                        rules: { 'probe/reads-stylesheet': 'error' }
                    }
                ]
            });
            const [result] = await eslint.lintFiles(['a.js']);

            return result.messages.length;
        };
        const write = (css) => {
            writeFileSync(stylesheet, css);
            return cssFingerprint({ root, entry: 'globals.css' });
        };

        return { lint, write };
    };

    it('replays a verdict while the stylesheet changes and nothing in the config does (the gap)', async () => {
        const { lint, write } = setup();
        const before = write('a { color: red; }');
        expect(await lint(before)).toBe(0);

        write('@utility card { padding: 1rem; }');

        // The rule would now report, and the cache still says clean: this is the false green.
        expect(await lint(before)).toBe(0);
    });

    it('lints again as soon as the fingerprint in the config follows the stylesheet', async () => {
        const { lint, write } = setup();
        expect(await lint(write('a { color: red; }'))).toBe(0);

        expect(await lint(write('@utility card { padding: 1rem; }'))).toBe(1);
        // And back: the cache entry of the new fingerprint is replaced in turn.
        expect(await lint(write('a { color: red; }'))).toBe(0);
    });
});

describe('eslint.config.js', { timeout: 60_000 }, () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const fingerprint = cssFingerprint({ root: process.cwd(), entry: 'app/globals.css' });

    it('carries the fingerprint of the Tailwind stylesheet for every file the Tailwind rules lint', async () => {
        const config = await eslint.calculateConfigForFile('app/providers.tsx');

        expect(config.settings.tailwindCssFingerprint).toBe(fingerprint);
    });

    it('leaves other files out, so a stylesheet edit does not re-lint them', async () => {
        const config = await eslint.calculateConfigForFile('shared/lib/logger.ts');

        expect(config.settings).not.toHaveProperty('tailwindCssFingerprint');
    });
});

describe('a numeric literal type is not a magic number', { timeout: 60_000 }, () => {
    const MAGIC_NUMBERS = '@typescript-eslint/no-magic-numbers';
    const eslint = new ESLint({ cwd: process.cwd() });

    // The options the real config resolves for the path, the rule run through `Linter`: no TypeScript
    // program is built, so a case costs milliseconds.
    const magicNumbers = async (code, filePath) => {
        const { rules } = await eslint.calculateConfigForFile(filePath);
        const messages = new Linter().verify(
            code,
            [
                {
                    files: ['**/*.ts'],
                    plugins: { '@typescript-eslint': tseslint.plugin },
                    languageOptions: { parser: tseslint.parser, sourceType: 'module' },
                    rules: { [MAGIC_NUMBERS]: rules[MAGIC_NUMBERS] }
                }
            ],
            { filename: filePath }
        );

        // A snippet that does not parse at all must never read as "no finding".
        expect(
            messages.filter(({ fatal }) => fatal),
            'the snippet must parse'
        ).toEqual([]);

        return messages;
    };

    // `type Gap = 3 | 5` names its numbers already; the rule used to ask for a constant behind each.
    it('accepts a union of numeric literal types declared as an alias', async () => {
        const found = await magicNumbers('export type Gap = 3 | 5;\n', 'shared/lib/gap.ts');

        expect(found).toEqual([]);
    });

    it('still counts the same numbers used as values', async () => {
        const found = await magicNumbers(
            'export const scale = (n: number): number => n * 3 + 5;\n',
            'shared/lib/gap.ts'
        );

        expect(found).toHaveLength(2);
    });

    // The option covers a union that is the whole alias; one written inside a property type is not
    // covered, which is why the rule note tells the author to name it as an alias.
    it('still counts a union written inline in a property type', async () => {
        const found = await magicNumbers(
            'export interface Props {\n    max?: 4 | 5;\n}\n',
            'shared/lib/gap.ts'
        );

        expect(found).toHaveLength(2);
    });
});

describe('the agent scratch folder `.cursor/`', { timeout: 60_000 }, () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    // The repository's own oxlint config, applied to a tree holding one file with a violation.
    const oxlintStatus = (place) => {
        const root = mkdtempSync(path.join(tmpdir(), 'oxlint-ignores-'));
        roots.push(root);
        copyFileSync('.oxlintrc.json', path.join(root, '.oxlintrc.json'));
        mkdirSync(path.dirname(path.join(root, place)), { recursive: true });
        writeFileSync(path.join(root, place), 'debugger;\n');
        // oxlint exits 1 when every file is ignored, which would read as a finding.
        writeFileSync(path.join(root, 'clean.mjs'), 'export const clean = 1;\n');

        return spawnSync(
            path.resolve('node_modules/.bin/oxlint'),
            ['--config', '.oxlintrc.json', '--deny-warnings', '.'],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        ).status;
    };

    it('oxlint ignores it, and still reads the same file anywhere else', () => {
        expect(oxlintStatus('scripts/probe.mjs'), 'the same file outside .cursor/').toBe(1);
        expect(oxlintStatus('.cursor/probe.mjs')).toBe(0);
    });

    it('ESLint ignores it, and still lints the same path anywhere else', async () => {
        const eslint = new ESLint({ cwd: process.cwd() });

        expect(await eslint.isPathIgnored('scripts/probe.mjs'), 'outside .cursor/').toBe(false);
        expect(await eslint.isPathIgnored('.cursor/probe.mjs')).toBe(true);
    });
});

describe('the commit hook formats every file the format check reads', { timeout: 60_000 }, () => {
    // A hook chain exports the git location variables; a child that inherits them reads the wrong repo.
    const GIT_LOCATION_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'];

    const trackedFiles = () => {
        const env = Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !GIT_LOCATION_VARIABLES.includes(key))
        );

        return execFileSync('git', ['ls-files', '-z'], {
            encoding: 'utf8',
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        })
            .split('\0')
            .filter(Boolean);
    };

    // `prettier --check .` reads every file that is not ignored and has a parser it can infer.
    const checkedByPrettier = async (files) => {
        const checked = [];
        for (const file of files) {
            const info = await prettier.getFileInfo(file, {
                ignorePath: ['.gitignore', '.prettierignore']
            });
            if (!info.ignored && info.inferredParser !== null) checked.push(file);
        }

        return checked;
    };

    it('matches every such file with at least one lint-staged glob', async () => {
        const { 'lint-staged': globs } = JSON.parse(readFileSync('package.json', 'utf8'));
        // lint-staged's own matcher (`lib/matchFiles.js`, `matchFiles`): a pattern without a slash
        // matches the file name in every folder (`matchBase`, line 16), dotfiles included (line 12).
        // Loaded by path because the package does not export it.
        const { matchFiles } = await import(
            pathToFileURL(path.resolve('node_modules/lint-staged/lib/matchFiles.js')).href
        );
        const files = await checkedByPrettier(trackedFiles());
        const unmatched = files.filter(
            (file) =>
                !Object.keys(globs).some(
                    (pattern) => matchFiles([{ filepath: file }], pattern).length > 0
                )
        );

        expect(files.length, 'the check must see files').toBeGreaterThan(0);
        expect(unmatched, 'files prettier checks but no lint-staged glob matches').toEqual([]);
    });
});

// The guards below lint a snippet with the options THIS repo's ESLint config resolves for a path, so a
// config edit that drops a rule turns a case red. The options come from `calculateConfigForFile` and the
// rule runs through `Linter`: no TypeScript program is built, so a case costs milliseconds.
const guardEslint = new ESLint({ cwd: process.cwd() });

const lintSnippet = (code, filePath, rules, plugins = {}) => {
    const messages = new Linter().verify(
        code,
        [
            {
                files: ['**/*.{ts,tsx}'],
                plugins,
                languageOptions: { parser: tseslint.parser, sourceType: 'module' },
                rules
            }
        ],
        { filename: filePath }
    );

    // A snippet that does not parse at all must never read as "no finding".
    expect(
        messages.filter(({ fatal }) => fatal),
        'the snippet must parse'
    ).toEqual([]);

    return messages;
};

describe('a browser subscription started in an effect is released by its cleanup', () => {
    const PLUGIN = 'react-web-api';
    const ERROR_SEVERITY = 2;

    // Every rule of the family, with a component that starts the subscription and returns nothing, and
    // the same component with the cleanup returned. A listener, a timer, an observer or a request that
    // outlives its component keeps running after it unmounts and holds the component's state.
    const CASES = [
        {
            rule: 'no-leaked-event-listener',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useResize = (onResize: () => void): void => {',
                '    useEffect(() => {',
                "        window.addEventListener('resize', onResize);",
                '    }, [onResize]);',
                '};'
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useResize = (onResize: () => void): void => {',
                '    useEffect(() => {',
                "        window.addEventListener('resize', onResize);",
                "        return () => window.removeEventListener('resize', onResize);",
                '    }, [onResize]);',
                '};'
            ]
        },
        {
            rule: 'no-leaked-interval',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useTick = (onTick: () => void): void => {',
                '    useEffect(() => {',
                '        setInterval(onTick, 500);',
                '    }, [onTick]);',
                '};'
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useTick = (onTick: () => void): void => {',
                '    useEffect(() => {',
                '        const id = setInterval(onTick, 500);',
                '        return () => clearInterval(id);',
                '    }, [onTick]);',
                '};'
            ]
        },
        {
            rule: 'no-leaked-timeout',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useDelay = (onDone: () => void): void => {',
                '    useEffect(() => {',
                '        setTimeout(onDone, 500);',
                '    }, [onDone]);',
                '};'
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useDelay = (onDone: () => void): void => {',
                '    useEffect(() => {',
                '        const id = setTimeout(onDone, 500);',
                '        return () => clearTimeout(id);',
                '    }, [onDone]);',
                '};'
            ]
        },
        {
            rule: 'no-leaked-fetch',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useLoad = (url: string, onData: (data: unknown) => void): void => {',
                '    useEffect(() => {',
                '        void fetch(url).then((response) => response.json()).then(onData);',
                '    }, [url, onData]);',
                '};'
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useLoad = (url: string, onData: (data: unknown) => void): void => {',
                '    useEffect(() => {',
                '        const controller = new AbortController();',
                '        void fetch(url, { signal: controller.signal })',
                '            .then((response) => response.json())',
                '            .then(onData);',
                '        return () => controller.abort();',
                '    }, [url, onData]);',
                '};'
            ]
        },
        {
            rule: 'no-leaked-intersection-observer',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useSeen = (el: Element, onSeen: () => void): void => {',
                '    useEffect(() => {',
                '        const observer = new IntersectionObserver(onSeen);',
                '        observer.observe(el);',
                '    }, [el, onSeen]);',
                '};'
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useSeen = (el: Element, onSeen: () => void): void => {',
                '    useEffect(() => {',
                '        const observer = new IntersectionObserver(onSeen);',
                '        observer.observe(el);',
                '        return () => observer.disconnect();',
                '    }, [el, onSeen]);',
                '};'
            ]
        },
        {
            rule: 'no-leaked-resize-observer',
            leaking: [
                "import { useEffect } from 'react';",
                'export const useWatch = (el: Element, onSize: () => void): void => {',
                '    useEffect(() => {',
                '        const observer = new ResizeObserver(onSize);',
                '        observer.observe(el);',
                '    }, [el, onSize]);',
                '};'
            ],
            released: [
                "import { useEffect } from 'react';",
                'export const useWatch = (el: Element, onSize: () => void): void => {',
                '    useEffect(() => {',
                '        const observer = new ResizeObserver(onSize);',
                '        observer.observe(el);',
                '        return () => observer.disconnect();',
                '    }, [el, onSize]);',
                '};'
            ]
        }
    ];

    const leaks = async (
        lines,
        rule,
        filePath = 'features/example-form/ui/useSubscription.tsx'
    ) => {
        const { rules, plugins } = await guardEslint.calculateConfigForFile(filePath);
        const id = `${PLUGIN}/${rule}`;
        // A rule the config leaves off reports nothing, which must never read as a pass.
        expect(rules[id], `${id} must be configured`).toBeDefined();
        return lintSnippet(
            lines.join('\n'),
            filePath,
            { [id]: rules[id] },
            { [PLUGIN]: plugins[PLUGIN] }
        );
    };

    it.each(CASES)('$rule is an error', async ({ rule }) => {
        const { rules } = await guardEslint.calculateConfigForFile(
            'features/example-form/ui/useSubscription.tsx'
        );

        expect([rules[`${PLUGIN}/${rule}`]?.[0]]).toEqual([ERROR_SEVERITY]);
    });

    it.each(CASES)('$rule flags an effect that never releases it', async ({ rule, leaking }) => {
        expect(await leaks(leaking, rule)).toHaveLength(1);
    });

    it.each(CASES)(
        '$rule accepts the effect that returns the cleanup',
        async ({ rule, released }) => {
            expect(await leaks(released, rule)).toEqual([]);
        }
    );

    it('covers a file outside the feature folders too, as the other React rules do', async () => {
        const [{ rule, leaking }] = CASES;

        expect(await leaks(leaking, rule, 'app/dev/useSubscription.tsx')).toHaveLength(1);
    });
});

describe('state derived from other state is computed during render', { timeout: 60_000 }, () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    // ESLint leaves `react-hooks/set-state-in-effect` off: `eslint-plugin-oxlint` switches off every rule
    // oxlint implements, and oxlint reports this one as `react/set-state-in-effect`. So the guard runs the
    // repository's own oxlint config over a tree holding one component.
    const oxlint = (lines) => {
        const root = mkdtempSync(path.join(tmpdir(), 'oxlint-derived-'));
        roots.push(root);
        copyFileSync('.oxlintrc.json', path.join(root, '.oxlintrc.json'));
        const file = path.join(root, 'features/example-form/ui/useFullName.tsx');
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, lines.join('\n'));

        const { status, stdout } = spawnSync(
            path.resolve('node_modules/.bin/oxlint'),
            ['--config', '.oxlintrc.json', '--deny-warnings', '.'],
            { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );

        return { status, stdout };
    };

    it('flags a state value that an effect rebuilds from other values', () => {
        const { status, stdout } = oxlint([
            "import { useEffect, useState } from 'react';",
            '',
            'export const useFullName = (first: string, last: string): string => {',
            "    const [full, setFull] = useState('');",
            '    useEffect(() => {',
            "        setFull(first + ' ' + last);",
            '    }, [first, last]);',
            '    return full;',
            '};',
            ''
        ]);

        expect(stdout).toContain('set-state-in-effect');
        expect(status).toBe(1);
    });

    it('accepts the value computed while rendering', () => {
        const { status, stdout } = oxlint([
            "export const useFullName = (first: string, last: string): string => first + ' ' + last;",
            ''
        ]);

        expect({ status, stdout: stdout.includes('set-state-in-effect') }).toEqual({
            status: 0,
            stdout: false
        });
    });

    // Known gap, recorded as a test so a later rule that closes it turns this case red on purpose:
    // a state copy of a prop with no effect at all is something no rule of the config reports.
    it('does not flag a state copy of a prop that has no effect (known gap)', () => {
        const { status, stdout } = oxlint([
            "import { useState } from 'react';",
            '',
            'export const useCopy = (props: { value: string }): string => {',
            '    const [value] = useState(props.value);',
            '    return value;',
            '};',
            ''
        ]);

        expect({ status, stdout: stdout.includes('useState') }).toEqual({
            status: 0,
            stdout: false
        });
    });
});
