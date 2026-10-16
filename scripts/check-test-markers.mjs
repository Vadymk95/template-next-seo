#!/usr/bin/env node
/**
 * test-markers - the quarantine rule of docs-check, run inside the code gate.
 *
 * A focused test (`.only`) shrinks the suite for every later run, and an unconditional `.skip` with
 * no dated reason hides a failing test. docs-check owns the rule (see checkQuarantine there: the
 * date is the first RED day, UTC, and may be at most 30 days out), but docs-check is a docs-class
 * check: the pre-commit hook runs it only when docs are staged and verify:iter does not run it, so
 * a bare `.only` or `.skip` passed the iterate check. This leg reads the test files alone, offline,
 * in well under a second, and sits in the chains, verify:iter included, next to the other
 * file-level checks. It adds no rule: it calls the docs-check function.
 *
 * Usage: node scripts/check-test-markers.mjs [--root <dir>]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { checkQuarantine, listTestFiles } from './docs-check.mjs';

/** The findings for every test file under `root`, judged against `today` (an ISO date, UTC). */
export const checkTestMarkers = ({ root, today }) =>
    checkQuarantine({
        tests: listTestFiles(root).map((file) => [
            file,
            readFileSync(path.join(root, file), 'utf8')
        ]),
        today
    });

const main = () => {
    const argv = process.argv.slice(2);
    const rootFlag = argv.indexOf('--root');
    const root = rootFlag === -1 ? process.cwd() : path.resolve(argv[rootFlag + 1]);
    const today = new Date().toISOString().slice(0, 10);

    const findings = checkTestMarkers({ root, today });
    if (findings.length === 0) return;

    console.error('\n✖ test-markers:');
    for (const finding of findings) console.error(`  - ${finding}`);
    console.error(
        '\nFix the test. A quarantine is a dated, capped loan (docs-check, quarantines); never edit the check.\n'
    );
    process.exit(1);
};

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
