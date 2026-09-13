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
        // Only the browser SPECS are excluded, not all of `e2e/`: the pure predicates under
        // `e2e/support/` are unit-tested here, which is why the two runners split on the
        // extension (`.spec.ts` = Playwright, `.test.ts` = Vitest) and both configs carry the
        // matching ignore. Excluding the whole directory silently dropped those tests.
        exclude: [
            '**/node_modules/**',
            '**/e2e/**/*.spec.ts',
            '.next/**',
            '.next-dev/**',
            // The `include` below is a wildcard, so an agent worktree under the repository root -
            // a full second checkout - is collected as if its tests were ours. Measured with a
            // probe file on 2026-09-13: without this line vitest collected it. The sibling repo
            // where this was found first ran 5615 tests instead of 1881 and went red on another
            // checkout's emulator-less suite. Agent worktrees belong OUTSIDE the repository; this
            // line is what makes the gate independent of anyone remembering it.
            '**/.claude/worktrees/**'
        ],
        setupFiles: ['./shared/lib/test-utils/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json'],
            // `scripts/` is gate tooling, not application code. Its DECISION logic
            // is unit-tested (`audit-gate.test.mjs`, `ensure-playwright.test.mjs`);
            // what stays uncovered is the `main()` I/O that spawns npm and writes to
            // the console, which a unit test cannot meaningfully reach. Counting it
            // toward the app thresholds moved statements from 196 to 331 and dropped
            // lines from 93% to 82% without a single line of app code changing —
            // the sibling templates avoid this by scoping coverage `include` to src.
            exclude: ['node_modules/**', 'test/**', '.next/**', 'app/**', 'scripts/**'],
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
            // Gate scripts are `.mjs` (executable ESM), so the default ts/tsx glob
            // above does not reach their tests.
            'scripts/**/*.{test,spec}.mjs',
            'shared/**/*.{test,spec}.{ts,tsx}',
            'features/**/*.{test,spec}.{ts,tsx}'
        ]
    },
    resolve: {
        alias: {
            '@': import.meta.dirname
        }
    }
});
