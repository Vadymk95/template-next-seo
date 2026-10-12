// The local half of the quarantine rule. docs-check owns the rule (a focused test never lands, an
// unconditional skip carries a dated reason, the date is capped); this leg runs it inside the code
// gate, because a bare `.only` or `.skip` used to pass every local layer and only the weekly docs
// workflow, after the merge, said anything.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { checkTestMarkers } from './check-test-markers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'check-test-markers.mjs');
const TODAY = '2026-10-10';

describe('check-test-markers', () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    const makeTree = (files) => {
        const root = mkdtempSync(path.join(tmpdir(), 'markers-'));
        roots.push(root);
        for (const [file, text] of Object.entries(files)) {
            mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
            writeFileSync(path.join(root, file), text);
        }
        return root;
    };

    const findings = (files) => checkTestMarkers({ root: makeTree(files), today: TODAY });

    it('passes a tree with no markers', () => {
        expect(findings({ 'shared/a.test.ts': "it('works', () => {});\n" })).toEqual([]);
    });

    it('fails a bare focused test', () => {
        const result = findings({ 'shared/a.test.ts': `${'it'}.only('works', () => {});\n` });

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('shared/a.test.ts:1');
        expect(result[0]).toContain('.only');
    });

    it('fails a bare unconditional skip', () => {
        const result = findings({ 'shared/a.test.ts': `${'it'}.skip('works', () => {});\n` });

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('quarantine until');
    });

    it('passes a skip that carries a dated reason inside the cap', () => {
        expect(
            findings({
                'shared/a.test.ts': `// quarantine until 2026-10-20: flaky on the CI runner.\n${'it'}.skip('works', () => {});\n`
            })
        ).toEqual([]);
    });

    it('fails a quarantine that falls due today, red on the date itself', () => {
        const result = findings({
            'shared/a.test.ts': `// quarantine until ${TODAY}: flaky.\n${'it'}.skip('works', () => {});\n`
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('expired');
    });

    it('fails a quarantine parked beyond the cap', () => {
        const result = findings({
            'shared/a.test.ts': `// quarantine until 2099-12-31: flaky.\n${'it'}.skip('works', () => {});\n`
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('30 days');
    });

    it('leaves a conditional skip alone', () => {
        expect(
            findings({ 'shared/a.test.ts': `${'it'}.skip(isCi, 'works', () => {});\n` })
        ).toEqual([]);
    });

    it('reads the browser specs too, not only the unit tests', () => {
        const result = findings({
            'e2e/home.spec.ts': `${'test'}.only('home', async () => {});\n`
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('e2e/home.spec.ts:1');
    });

    describe('the CLI', () => {
        const run = (root) => {
            const env = { ...process.env };
            for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) {
                delete env[key];
            }
            const result = spawnSync('node', [SCRIPT, '--root', root], { env, encoding: 'utf8' });
            return { code: result.status, output: `${result.stdout}${result.stderr}` };
        };

        it('exits 1 and names the file for a focused test', () => {
            const root = makeTree({ 'shared/a.test.ts': `${'it'}.only('works', () => {});\n` });

            const verdict = run(root);

            expect(verdict.code).toBe(1);
            expect(verdict.output).toContain('shared/a.test.ts:1');
        });

        it('exits 0 on a clean tree', () => {
            const root = makeTree({ 'shared/a.test.ts': "it('works', () => {});\n" });

            expect(run(root).code).toBe(0);
        });
    });
});

describe('vitest configuration', () => {
    it('refuses a focused test everywhere, not only on CI', async () => {
        // vitest defaults `allowOnly` to "not CI", so a `.only` that passes locally fails only after the
        // push. The marker check above is the readable message; this is the runner itself saying no.
        const { default: config } = await import('../vitest.config.ts');

        expect(config.test.allowOnly).toBe(false);
    });
});
