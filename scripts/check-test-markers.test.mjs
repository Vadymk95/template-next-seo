// The local half of the quarantine rule. docs-check owns the rule (a focused test never lands, an
// unconditional skip carries a dated reason, the date is capped); this leg runs it inside the code
// gate, because a bare `.only` or `.skip` used to pass every local layer and only the weekly docs
// workflow, after the merge, said anything.
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    symlinkSync,
    unlinkSync,
    writeFileSync
} from 'node:fs';
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

    /* A Jest focus name is read as the Jest global unless the file declares that name itself: a
       helper called `fit` is not a focused test. The markers are assembled from parts: the check
       reads this file too, and a literal one in its text would be reported against the very rule
       these cases pin. */
    describe('a Jest name the file declares itself', () => {
        const FIT = `${'f'}it`;
        const FDESCRIBE = `${'f'}describe`;
        const lines = (...parts) => `${parts.join('\n')}\n`;

        it('reports a Jest focused test definition', () => {
            const result = findings({ 'shared/a.test.ts': `${FIT}('works', () => {});\n` });

            expect(result).toHaveLength(1);
            expect(result[0]).toContain('shared/a.test.ts:1');
            expect(result[0]).toContain('a focused test');
        });

        it('reports a focused describe', () => {
            const result = findings({
                'shared/a.test.ts': `${'describe'}.only('works', () => {});\n`
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toContain('.only');
        });

        it('does not report an arrow helper with a Jest name, nor its calls inside a test', () => {
            const text = lines(
                `const ${FIT} = (value) => value * 2;`,
                "it('doubles', () => {",
                `    expect(${FIT}(2)).toBe(4);`,
                '});'
            );

            expect(findings({ 'shared/a.test.ts': text })).toEqual([]);
        });

        it('does not report a function helper with a Jest name, nor its calls inside a test', () => {
            const text = lines(
                `function ${FIT}(value) {`,
                '    return value * 2;',
                '}',
                "it('doubles', () => {",
                `    ${FIT}(2);`,
                `    expect(${FIT}(2)).toBe(4);`,
                '});'
            );

            expect(findings({ 'shared/a.test.ts': text })).toEqual([]);
        });

        it('does not report a method called on an object', () => {
            const text = lines("it('fits', () => {", `    layout.${FIT}(2);`, '});');

            expect(findings({ 'shared/a.test.ts': text })).toEqual([]);
        });

        it('reports a real focused test when only a helper with a longer name is declared', () => {
            const text = lines(
                `const ${FIT}Text = (value) => value;`,
                `${FIT}('works', () => {});`
            );

            const result = findings({ 'shared/a.test.ts': text });

            expect(result).toHaveLength(1);
            expect(result[0]).toContain('shared/a.test.ts:2');
        });

        it('reports another Jest name in a file whose helper only shares the first one', () => {
            const text = lines(
                `function ${FIT}(value) {`,
                '    return value;',
                '}',
                `${FDESCRIBE}('works', () => {});`
            );

            const result = findings({ 'shared/a.test.ts': text });

            expect(result).toHaveLength(1);
            expect(result[0]).toContain('shared/a.test.ts:4');
        });

        it('reports the name imported from the Jest globals, which is the real API', () => {
            const text = lines(
                `import { ${FIT} } from '@jest/globals';`,
                `${FIT}('works', () => {});`
            );

            const result = findings({ 'shared/a.test.ts': text });

            expect(result).toHaveLength(1);
            expect(result[0]).toContain('shared/a.test.ts:2');
        });
    });

    describe('the CLI', () => {
        const run = (root, script = SCRIPT) => {
            const env = { ...process.env };
            for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) {
                delete env[key];
            }
            const result = spawnSync('node', [script, '--root', root], { env, encoding: 'utf8' });
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

        /* The script runs only when node was started on it, and it used to decide that by comparing its
           own URL with `file://` + the path node was given. That spelling breaks for a path through a
           symlink and for one with `#`, `%` or `?` in it: the script then did nothing and exited 0, so a
           planted focused test passed the gate. Each case plants one and expects the refusal. */
        describe('started by a path a hand-built file URL cannot spell', () => {
            const plant = () =>
                makeTree({ 'shared/a.test.ts': `${'it'}.only('works', () => {});\n` });

            const expectRefusal = (script) => {
                const verdict = run(plant(), script);

                expect(verdict.code, verdict.output).toBe(1);
                expect(verdict.output).toContain('shared/a.test.ts:1');
            };

            it('through a symlinked checkout path', () => {
                const holder = mkdtempSync(path.join(tmpdir(), 'markers-link-'));
                roots.push(holder);
                const checkout = path.join(holder, 'checkout');
                symlinkSync(path.resolve(HERE, '..'), checkout);
                try {
                    expectRefusal(path.join(checkout, 'scripts', 'check-test-markers.mjs'));
                } finally {
                    // The link goes first, so the recursive clean-up of `holder` never meets it.
                    unlinkSync(checkout);
                }
            });

            it('from a directory named with #, % and ?', () => {
                const holder = mkdtempSync(path.join(tmpdir(), 'markers-odd-'));
                roots.push(holder);
                const scripts = path.join(holder, 'a#b%c?d e', 'scripts');
                mkdirSync(scripts, { recursive: true });
                // Everything the script may import, so a new import cannot turn this into a crash.
                for (const name of readdirSync(HERE)) {
                    if (name.endsWith('.mjs') && !name.includes('.test.')) {
                        copyFileSync(path.join(HERE, name), path.join(scripts, name));
                    }
                }

                expectRefusal(path.join(scripts, 'check-test-markers.mjs'));
            });
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
