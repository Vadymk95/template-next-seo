// The Tailwind lint rules open `app/globals.css` themselves, so ESLint's cache, which keys on the linted
// file and the resolved config, replays the verdicts of an older stylesheet. The fingerprint put into
// the config closes that gap, and it is only as good as its inputs: a stylesheet the rules read but
// the hash missed is a false green again. These cases pin what is read, and what is not.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cssFingerprint, cssInputs } from './css-fingerprint.mjs';

describe('css-fingerprint', () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    const makeRoot = (files) => {
        const root = mkdtempSync(path.join(tmpdir(), 'css-fingerprint-'));
        roots.push(root);
        for (const [file, text] of Object.entries(files)) {
            mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
            writeFileSync(path.join(root, file), text);
        }
        return root;
    };

    const fingerprint = (root, entry = 'app/globals.css') => cssFingerprint({ root, entry });
    const inputs = (root, entry = 'app/globals.css') =>
        cssInputs({ root, entry }).map((file) => path.relative(root, file));

    const ENTRY = "@import 'tailwindcss';\n@theme { --spacing: 0.25rem; }\n";

    describe('cssFingerprint', () => {
        it('is stable for the same stylesheets and independent of where the checkout lives', () => {
            const files = { 'app/globals.css': ENTRY };

            expect(fingerprint(makeRoot(files))).toBe(fingerprint(makeRoot(files)));
            expect(fingerprint(makeRoot(files))).toMatch(/^[0-9a-f]{16}$/);
        });

        it('changes when the entry stylesheet changes', () => {
            const before = fingerprint(makeRoot({ 'app/globals.css': ENTRY }));
            const after = fingerprint(
                makeRoot({ 'app/globals.css': `${ENTRY}@utility card { padding: 1rem; }\n` })
            );

            expect(after).not.toBe(before);
        });

        it('changes when a local stylesheet it imports changes, however deep the chain', () => {
            const tree = (leaf) => ({
                'app/globals.css': "@import './theme.css';\n",
                'app/theme.css': "@import './tokens/colors.css';\n",
                'app/tokens/colors.css': leaf
            });

            expect(fingerprint(makeRoot(tree(':root { --brand: red; }')))).not.toBe(
                fingerprint(makeRoot(tree(':root { --brand: blue; }')))
            );
        });

        it('does not change with a stylesheet nothing imports', () => {
            const tree = (stray) => ({ 'app/globals.css': ENTRY, 'app/stray.css': stray });

            expect(fingerprint(makeRoot(tree('a { color: red; }')))).toBe(
                fingerprint(makeRoot(tree('a { color: blue; }')))
            );
        });

        it('notices an imported stylesheet that did not exist before', () => {
            const entry = "@import './later.css';\n";
            const without = fingerprint(makeRoot({ 'app/globals.css': entry }));
            const withIt = fingerprint(
                makeRoot({ 'app/globals.css': entry, 'app/later.css': 'a { color: red; }' })
            );

            expect(withIt).not.toBe(without);
        });

        it('fails, naming the file, when the entry stylesheet is missing', () => {
            const root = makeRoot({ 'app/other.css': ENTRY });

            expect(() => fingerprint(root)).toThrow(
                /Tailwind entry stylesheet app\/globals\.css does not exist/
            );
        });
    });

    describe('cssInputs', () => {
        it('lists the entry first, then what it imports, depth first', () => {
            const root = makeRoot({
                'app/globals.css': "@import './a.css';\n@import './b.css';\n",
                'app/a.css': "@import './a-child.css';\n",
                'app/a-child.css': '',
                'app/b.css': ''
            });

            expect(inputs(root)).toEqual([
                'app/globals.css',
                'app/a.css',
                'app/a-child.css',
                'app/b.css'
            ]);
        });

        it.each([
            ['double quotes', '@import "./x.css";'],
            ['single quotes', "@import './x.css';"],
            ['a layer clause', "@import './x.css' layer(base);"],
            ['url() with quotes', '@import url("./x.css");'],
            ['url() without quotes', '@import url(./x.css) screen;'],
            ['a parent folder', "@import '../shared/x.css';"],
            ['a bare file name beside the importer', '@import "x.css";']
        ])('follows an import written with %s', (_label, statement) => {
            const root = makeRoot({
                'app/globals.css': `${statement}\n`,
                'app/x.css': '',
                'shared/x.css': ''
            });
            const found = inputs(root);

            expect(found.length, found.join(', ')).toBeGreaterThan(1);
        });

        it('leaves packages alone: their files live in node_modules and move with the lockfile', () => {
            const root = makeRoot({
                'app/globals.css': "@import 'tailwindcss';\n@import 'tw-animate-css';\n"
            });

            expect(inputs(root)).toEqual(['app/globals.css']);
        });

        it('skips a relative import whose file is missing instead of failing on it', () => {
            const root = makeRoot({ 'app/globals.css': "@import './gone.css';\n" });

            expect(inputs(root)).toEqual(['app/globals.css']);
        });

        it('lists a file once, and terminates on a cycle', () => {
            const root = makeRoot({
                'app/globals.css': "@import './a.css';\n@import './a.css';\n",
                'app/a.css': "@import './globals.css';\n"
            });

            expect(inputs(root)).toEqual(['app/globals.css', 'app/a.css']);
        });
    });
});
