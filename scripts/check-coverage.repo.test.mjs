// The case of check-coverage.test.mjs that reads this repository's own vitest.config.ts. The rest of
// that file lives in gatelaw.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('the coverage reporter', () => {
    // The `text` reporter prints a row per file into every coverage log and nothing reads it; the summary
    // prints the four totals, and a missed threshold is still named.
    it('prints the four totals in the terminal, not a row per file', () => {
        const config = readFileSync(path.join(process.cwd(), 'vitest.config.ts'), 'utf8');

        expect(config).toMatch(/^\s*reporter:\s*\['text-summary',/m);
    });
});
