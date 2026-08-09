import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import pluginImport from 'eslint-plugin-import-x';
import oxlintPlugin from 'eslint-plugin-oxlint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import pluginReact from 'eslint-plugin-react';
import tailwind from 'eslint-plugin-tailwindcss';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Prefer `@/` over parent-relative imports (aligned with template-1). */
const parentRelativeImportPatternGroup = {
    group: [
        '../*',
        '../../*',
        '../../../*',
        '../../../../*',
        '../../../../../*',
        '../../../../../../*'
    ],
    message:
        'Use the `@/` path alias instead of parent-relative imports (e.g. `@/features/...`, `@/public/...`).'
};

const reactRecommended = {
    ...pluginReact.configs.flat.recommended.rules,
    ...pluginReact.configs.flat['jsx-runtime'].rules,
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/no-array-index-key': 'error',
    'react/no-unstable-nested-components': 'error',
    'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
    'react/self-closing-comp': ['error', { component: true, html: false }]
};

export default defineConfig([
    globalIgnores([
        '.next-dev',
        '.next',
        'dist',
        'node_modules',
        'playwright-report',
        'test-results',
        'blob-report',
        'playwright/.cache',
        'public/mockServiceWorker.js',
        'next-env.d.ts',
        'postcss.config.mjs'
    ]),
    ...nextCoreWebVitals,
    ...nextTypescript,
    oxlintPlugin.configs['flat/all'],
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            'import-x': pluginImport,
            react: pluginReact
        },
        languageOptions: {
            ecmaVersion: 'latest',
            globals: { ...globals.browser, ...globals.node },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        settings: {
            // NOT 'detect' — see the trailing settings block at the end of this
            // file for why that crashes under ESLint 10.
            react: { version: '19.2' },
            'import-x/resolver-next': [
                createTypeScriptImportResolver({
                    alwaysTryTypes: true,
                    project: './tsconfig.json'
                })
            ]
        },
        rules: {
            ...pluginImport.flatConfigs.recommended.rules,
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
                    pathGroups: [
                        {
                            pattern: '@tailwindcss/**',
                            group: 'external',
                            position: 'before'
                        },
                        {
                            pattern: '@/**',
                            group: 'internal',
                            position: 'before'
                        }
                    ],
                    pathGroupsExcludedImportTypes: ['builtin'],
                    alphabetize: { order: 'asc', caseInsensitive: true },
                    'newlines-between': 'always'
                }
            ],
            'import-x/no-cycle': 'error',
            'import-x/no-restricted-paths': [
                'error',
                {
                    zones: [
                        {
                            target: './shared',
                            from: ['./app', './features', './entities'],
                            message:
                                'FSD: shared is the lowest layer; it must not import from app, features, or entities.'
                        },
                        {
                            target: './entities',
                            from: ['./app', './features'],
                            message: 'FSD: entities may only import from shared.'
                        },
                        {
                            target: './features',
                            from: ['./app'],
                            except: ['./actions'],
                            message:
                                'FSD: features may only import from entities/shared; the only allowed app import is a Server Action from app/actions.'
                        }
                    ]
                }
            ],
            'no-console': 'error',

            // ─── Magic numbers — extract to a named constant (exempt below) ───
            // Cheap models scatter literals; force named constants. Ignored:
            // trivial (-1,0,1,2), universal units (60 s/min, 1000 ms/s, 100 %),
            // and the HTTP status codes. A status code is a standard table, not
            // domain magic — `{ status: 404 }` is self-documenting at the use
            // site, which this repo's constants ADR names as a reason NOT to
            // extract. Naming 20 of them would add indirection, not insight.
            '@typescript-eslint/no-magic-numbers': [
                'error',
                {
                    ignore: [
                        -1, 0, 1, 2, 60, 100, 1000,
                        // HTTP status codes
                        200, 201, 204, 301, 302, 304, 307, 308, 400, 401, 403, 404, 405, 409, 413,
                        422, 429, 500, 502, 503
                    ],
                    ignoreEnums: true,
                    ignoreReadonlyClassProperties: true,
                    ignoreArrayIndexes: true,
                    ignoreDefaultValues: true,
                    ignoreTypeIndexes: true
                }
            ],
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'react',
                            importNames: ['FC'],
                            message:
                                "Use 'FunctionComponent' instead: const MyComponent: FunctionComponent<Props> = ({ ... }) => { ... }"
                        }
                    ],
                    patterns: [parentRelativeImportPatternGroup]
                }
            ],
            ...reactRecommended,
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
            ],
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
            ],
            // ─── Explicit in/out contracts ───────────────────────────────────
            // Every named function declares its output: a variable annotation
            // (const X: FunctionComponent<Props> = () => …), an explicit return
            // type (const useX = (): UseXResult => …), or for RSC/route entries
            // `async function Page(): Promise<ReactElement>`. Inline callbacks
            // passed as arguments/JSX props stay free (allowExpressions).
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                    allowHigherOrderFunctions: true,
                    allowIIFEs: true
                }
            ],
            // Property-style signatures (`onSelect: (id: string) => void`) get
            // strict contravariant parameter checks; method style (`onSelect(id)`)
            // is checked bivariantly — looser, can hide unsound narrowing.
            '@typescript-eslint/method-signature-style': ['error', 'property'],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': [
                'error',
                {
                    checksVoidReturn: {
                        attributes: false
                    }
                }
            ]
        }
    },
    {
        files: ['shared/ui/**/*.{ts,tsx}', 'features/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'Literal[value=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]',
                    message: 'No raw hex colors in components; use a design token.'
                },
                {
                    selector:
                        'TemplateElement[value.raw=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]',
                    message: 'No raw hex colors in components; use a design token.'
                }
            ]
        }
    },
    {
        files: ['**/*.tsx'],
        plugins: { tailwindcss: tailwind },
        settings: {
            tailwindcss: { cssConfigPath: './app/globals.css' }
        },
        rules: {
            'tailwindcss/no-contradicting-classname': 'error',
            'tailwindcss/classnames-order': 'error',
            'tailwindcss/enforces-shorthand': 'error',
            'tailwindcss/no-unnecessary-arbitrary-value': 'error'
        }
    },
    prettierRecommended,
    {
        files: ['shared/lib/logger.ts'],
        rules: {
            'no-console': 'off'
        }
    },
    {
        files: ['**/*.{test,spec}.{ts,tsx}', 'shared/lib/test-utils/**/*.{ts,tsx}'],
        rules: {
            // Test helpers/fixtures don't need declared return contracts.
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            'no-console': 'off',
            'no-restricted-syntax': 'off',
            // Fixture values are the point of a test; naming them adds indirection.
            '@typescript-eslint/no-magic-numbers': 'off'
        }
    },
    // ─── Framework config files ──────────────────────────────────────────────
    // `next.config.ts` image `deviceSizes` / `imageSizes` and the Playwright
    // timeouts are values of a documented framework contract, not domain logic.
    // Naming them would move a Next.js table into our vocabulary for no gain.
    {
        files: ['*.config.{ts,js,mjs}'],
        rules: {
            '@typescript-eslint/no-magic-numbers': 'off'
        }
    },
    {
        ...tseslint.configs.disableTypeChecked,
        files: ['e2e/**/*.ts', 'playwright.config.ts', 'playwright.dev.config.ts'],
        languageOptions: {
            ...tseslint.configs.disableTypeChecked.languageOptions,
            globals: { ...globals.node }
        },
        rules: {
            ...tseslint.configs.disableTypeChecked.rules,
            '@typescript-eslint/explicit-function-return-type': 'off',
            'import-x/no-cycle': 'off',
            'import-x/order': 'off',
            'no-console': 'off'
        }
    },
    /*
     * Tailwind class HYGIENE, alongside `eslint-plugin-tailwindcss` rather than instead of it — the two
     * rule sets do not overlap. Adopted on a measured pre-flight: `no-deprecated-classes` earns its
     * place immediately because a Tailwind MINOR can rename a utility, the build emits no warning, and
     * `outline-none` -> `outline-hidden` proved a rename can be an accessibility change wearing a
     * rename's clothes.
     *
     * `no-unknown-classes` stays OFF: in a TEMPLATE its failure mode is a false positive on the first
     * hand-written CSS class a consumer adds.
     */
    {
        files: ['**/*.tsx'],
        plugins: { 'better-tailwindcss': betterTailwindcss },
        settings: { 'better-tailwindcss': { entryPoint: './app/globals.css' } },
        rules: {
            'better-tailwindcss/no-deprecated-classes': 'error',
            'better-tailwindcss/enforce-canonical-classes': 'error'
        }
    },
    /*
     * Complexity ratchet — thresholds sit ABOVE the measured ceiling, so the tree is
     * clean today and only future drift can trip them. Measured 2026-08-09 over
     * app/features/shared/i18n excluding tests (ESLint API probe, every rule warn-zero):
     *   complexity              max 12  (worst: app/api/csp-report/route.ts, features/example-form/ui/ExampleForm.tsx)
     *   max-depth               max 3
     *   max-params              max 5   (worst: shared/lib/rateLimitCore.ts)
     *   max-lines-per-function  max 102 (worst: features/example-form/ui/ExampleForm.tsx)
     *   max-lines               max 143 (worst: app/dev/ui/content-stress/ContentStressPage.tsx)
     * Tests and shared/lib/test-utils are exempt on purpose: a describe block is one
     * function and table-driven suites are long by design, so these rules there would
     * only teach people to split tests for the linter's sake. When a threshold fires,
     * the first answer is to split the function, not to raise the number; raising it
     * needs a fresh measurement and a DECISIONS.md line ("Complexity ratchet" entry).
     */
    {
        files: [
            'app/**/*.{ts,tsx}',
            'features/**/*.{ts,tsx}',
            'shared/**/*.{ts,tsx}',
            'i18n/**/*.{ts,tsx}'
        ],
        ignores: ['**/*.test.*', '**/*.spec.*', 'shared/lib/test-utils/**'],
        rules: {
            complexity: ['error', 15],
            'max-depth': ['error', 4],
            'max-params': ['error', 6],
            'max-lines-per-function': [
                'error',
                { max: 130, skipBlankLines: true, skipComments: true }
            ],
            'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }]
        }
    },
    /*
     * REQUIRED for ESLint 10, do not set back to 'detect'. `eslint-plugin-react`
     * resolves `version: 'detect'` through `detectReactVersion` -> `resolveBasedir`,
     * which calls the `context.getFilename()` API that ESLint 10 removed; every
     * react rule needing the version then throws at load. An explicit string skips
     * that path entirely (`lib/util/version.js`).
     * This block deliberately has NO `files` key, so it applies to every linted file
     * and wins over `eslint-config-next`, which sets 'detect' for its own patterns —
     * pinning only the settings block above is NOT enough, the run then crashes on
     * files matched solely by the Next config.
     * Keep it in step with the `react` major/minor in package.json.
     */
    {
        settings: { react: { version: '19.2' } }
    }
]);
