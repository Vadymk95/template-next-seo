import queryPlugin from '@tanstack/eslint-plugin-query';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import pluginImport from 'eslint-plugin-import-x';
import oxlintPlugin from 'eslint-plugin-oxlint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import pluginReact from 'eslint-plugin-react';
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
    ...queryPlugin.configs['flat/recommended'],
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
    prettierRecommended,
    {
        files: ['shared/lib/logger.ts', 'shared/lib/web-vitals.ts'],
        rules: {
            'no-console': 'off'
        }
    },
    {
        files: ['**/*.{test,spec}.{ts,tsx}', 'shared/lib/test-utils/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            'no-console': 'off'
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
            'import-x/no-cycle': 'off',
            'import-x/order': 'off',
            'no-console': 'off'
        }
    }
]);
