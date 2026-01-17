import js from '@eslint/js';
import queryPlugin from '@tanstack/eslint-plugin-query';
import prettier from 'eslint-config-prettier';
import pluginImport from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    globalIgnores(['.next', 'dist', 'node_modules']),
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            'jsx-a11y': jsxA11y
        },
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs['recommended-latest'],
            queryPlugin.configs['flat/recommended'],
            pluginImport.flatConfigs.recommended,
            prettier
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: { ...globals.browser, ...globals.node }
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: ['./tsconfig.json'],
                    alwaysTryTypes: true
                },
                node: {
                    extensions: ['.js', '.jsx', '.ts', '.tsx']
                }
            },
            'import/extensions': ['.js', '.jsx', '.ts', '.tsx']
        },
        rules: {
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
                    pathGroups: [
                        {
                            pattern: 'tailwindcss/**',
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
            ...jsxA11y.configs.recommended.rules
        }
    },
    {
        files: ['next-env.d.ts'],
        rules: {
            '@typescript-eslint/triple-slash-reference': 'off'
        }
    }
]);
