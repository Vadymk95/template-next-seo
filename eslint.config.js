import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
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
            react: { version: 'detect' },
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
            'no-restricted-syntax': 'off'
        }
    },
    {
        ...tseslint.configs.disableTypeChecked,
        files: ['e2e/**/*.ts', 'playwright.config.ts'],
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
    }
]);
