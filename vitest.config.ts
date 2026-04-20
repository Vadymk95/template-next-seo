import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [
        react({
            jsxRuntime: 'automatic'
        })
    ],
    test: {
        globals: true,
        environment: 'jsdom',
        exclude: ['**/node_modules/**', '**/e2e/**', '.next/**'],
        setupFiles: ['./shared/lib/test-utils/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json'],
            exclude: ['node_modules/', 'test/', '.next/', 'app/'],
            reportsDirectory: './coverage',
            thresholds: {
                lines: 85,
                branches: 70,
                functions: 75,
                statements: 85
            }
        },
        include: [
            '**/*.{test,spec}.{ts,tsx}',
            'shared/**/*.{test,spec}.{ts,tsx}',
            'features/**/*.{test,spec}.{ts,tsx}'
        ]
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './')
        }
    }
});
