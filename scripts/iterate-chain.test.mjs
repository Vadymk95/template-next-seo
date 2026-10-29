// The iterate chain is data in package.json (`verify:iter:inner`), and docs:check keeps its readable view in
// gate-tiers.json equal to it. Nothing says WHICH stages it has to hold, so a stage dropped from both stays
// consistent and silent. Three were once missing, each for a reason that is easy to forget:
//   - ESLint on the changed files: oxlint has no types, so type-aware findings reached the commit hook first;
//   - the layer-scope test by name: it reads configs as text, nothing imports it, `--changed` never selects it;
//   - `typecheck` going through the stale-route-types step, which the commit hook reaches by calling the script.
import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
const iterateSteps = scripts['verify:iter:inner'].split(/\s+&&\s+/);

describe('the iterate chain', () => {
    it('lints the changed files with ESLint, after the type check', () => {
        const lint = iterateSteps.indexOf('node scripts/lint-changed.mjs');

        expect(lint, 'node scripts/lint-changed.mjs').toBeGreaterThan(-1);
        expect(lint).toBeGreaterThan(iterateSteps.indexOf('npm run typecheck'));
        expect(existsSync('scripts/lint-changed.mjs')).toBe(true);
    });

    it('runs the layer-scope test by name, because `--changed` never selects it', () => {
        const scope = 'scripts/mutation-scope.test.mjs';

        expect(iterateSteps).toContain(`vitest run ${scope}`);
        expect(existsSync(scope)).toBe(true);
    });

    it('type-checks through the step that drops stale route types, the commit hook included', () => {
        expect(scripts.typecheck).toBe('node scripts/drop-stale-route-types.mjs && tsc --noEmit');
        expect(iterateSteps).toContain('npm run typecheck');
        // The pre-commit hook type-checks the whole repository through the script, not through tsc.
        expect(readFileSync('.husky/pre-commit', 'utf8')).toMatch(/^\s*npm run typecheck\b/m);
    });
});
