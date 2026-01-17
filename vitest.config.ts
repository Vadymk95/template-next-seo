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
        setupFiles: ['./shared/lib/test-utils/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json'],
            exclude: ['node_modules/', 'test/', '.next/', 'app/'],
            reportsDirectory: './coverage'
        },
        include: [
            '**/*.{test,spec}.{ts,tsx}',
            'shared/**/*.{test,spec}.{ts,tsx}',
            'entities/**/*.{test,spec}.{ts,tsx}',
            'features/**/*.{test,spec}.{ts,tsx}'
        ]
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './')
        }
    }
});
