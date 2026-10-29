// `npm run typecheck` drops the generated route type files that name a route which no longer exists.
// Next writes them (the validator under `next dev`, the validator and one stub per route after a
// build) and rewrites them only while it runs; delete a route and they keep importing the module
// that is gone, so `tsc` fails with TS2307 on a file nobody edited. The declaration files beside
// them stay: `next-env.d.ts` imports them, and dropping them would break `tsc` the other way.
import { execFileSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    symlinkSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { dropStaleRouteTypes } from './drop-stale-route-types.mjs';

const SCRIPT = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'drop-stale-route-types.mjs'
);

// The shape Next generates, cut down to what matters here: type-only imports of the generated
// declarations (never stale) and `typeof import(...)` of every route module.
const validator = (...routes) =>
    [
        '// This file is generated automatically by Next.js',
        'import type { AppRoutes } from "./routes.js"',
        'import type { NextRequest } from "next/server.js"',
        ...routes.map((route) => `const handler = {} as typeof import("${route}")`)
    ].join('\n');

// The per-route stub a build writes: a value import and a type import of the same route module.
const stub = (route) =>
    ["import * as entry from '" + route + "'", "type TEntry = typeof import('" + route + "')"].join(
        '\n'
    );

describe('dropStaleRouteTypes', () => {
    const roots = [];

    afterEach(() => {
        for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    const makeRoot = (files) => {
        const root = mkdtempSync(path.join(tmpdir(), 'route-types-'));
        roots.push(root);
        for (const [file, text] of Object.entries(files)) {
            mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
            writeFileSync(path.join(root, file), text);
        }
        return root;
    };

    const exists = (root, file) => existsSync(path.join(root, file));

    describe('the validator', () => {
        it.each([
            ['the dev validator', '.next/dev/types/validator.ts', '../../../app'],
            ['the build validator', '.next/types/validator.ts', '../../app'],
            ['the dev-smoke build validator', '.next-dev/types/validator.ts', '../../app'],
            ['the dev-smoke dev validator', '.next-dev/dev/types/validator.ts', '../../../app']
        ])('drops %s when it names a deleted route', (_label, file, up) => {
            const root = makeRoot({
                'app/page.tsx': 'export default null;\n',
                [file]: validator(`${up}/page.js`, `${up}/[locale]/zz-probe/page.js`)
            });

            const dropped = dropStaleRouteTypes({ root });

            expect(exists(root, file)).toBe(false);
            expect(dropped).toEqual([file]);
        });

        it('keeps a validator whose routes all exist, so route exports stay validated', () => {
            const root = makeRoot({
                'app/page.tsx': 'export default null;\n',
                'app/[locale]/example-form/page.tsx': 'export default null;\n',
                'app/api/health/route.ts': 'export const GET = null;\n',
                '.next/dev/types/validator.ts': validator(
                    '../../../app/page.js',
                    '../../../app/[locale]/example-form/page.js',
                    '../../../app/api/health/route.js'
                )
            });

            expect(dropStaleRouteTypes({ root })).toEqual([]);
            expect(exists(root, '.next/dev/types/validator.ts')).toBe(true);
        });

        it('resolves the .js a generated import spells to the .tsx, .ts or .jsx file on disk', () => {
            const root = makeRoot({
                'app/a/page.tsx': '',
                'app/b/route.ts': '',
                'app/c/page.jsx': '',
                'app/d/page.js': '',
                '.next/types/validator.ts': validator(
                    '../../app/a/page.js',
                    '../../app/b/route.js',
                    '../../app/c/page.js',
                    '../../app/d/page.js'
                )
            });

            expect(dropStaleRouteTypes({ root })).toEqual([]);
        });

        it('treats a generated sibling (`./routes.js` is `routes.d.ts`) and a package as present', () => {
            const root = makeRoot({
                'app/page.tsx': '',
                '.next/types/validator.ts': validator('../../app/page.js')
            });

            expect(dropStaleRouteTypes({ root })).toEqual([]);
        });
    });

    describe('the per-route stubs of a build', () => {
        it('drops the stub of a deleted route and keeps the stub of a live one', () => {
            const root = makeRoot({
                'app/[locale]/page.tsx': '',
                '.next/types/app/[locale]/page.ts': stub('../../../../app/[locale]/page.js'),
                '.next/types/app/[locale]/zz-probe/page.ts': stub(
                    '../../../../../app/[locale]/zz-probe/page.js'
                )
            });

            const dropped = dropStaleRouteTypes({ root });

            expect(dropped).toEqual(['.next/types/app/[locale]/zz-probe/page.ts']);
            expect(exists(root, '.next/types/app/[locale]/page.ts')).toBe(true);
        });
    });

    describe('what is never touched', () => {
        it('leaves the declaration files, whatever else is dropped', () => {
            const declarations = [
                '.next/dev/types/routes.d.ts',
                '.next/dev/types/root-params.d.ts',
                '.next/dev/types/cache-life.d.ts',
                '.next/types/routes.d.ts',
                '.next/types/root-params.d.ts',
                '.next/types/cache-life.d.ts'
            ];
            // Each one names a route that is gone: it is still not ours to remove.
            const naming = (file) =>
                `export type Gone = typeof import('${file.startsWith('.next/dev') ? '../../../' : '../../'}app/gone/page.js')\n`;
            const root = makeRoot({
                ...Object.fromEntries(declarations.map((file) => [file, naming(file)])),
                '.next/dev/types/validator.ts': validator('../../../app/gone/page.js'),
                '.next/types/validator.ts': validator('../../app/gone/page.js')
            });

            dropStaleRouteTypes({ root });

            for (const file of declarations) expect(exists(root, file), file).toBe(true);
        });

        it('does nothing, and does not fail, when no Next output exists', () => {
            const root = makeRoot({ 'app/page.tsx': '' });

            expect(dropStaleRouteTypes({ root })).toEqual([]);
        });

        it('leaves a type file that imports nothing outside the output folder', () => {
            const root = makeRoot({ '.next/types/validator.ts': validator() });

            expect(dropStaleRouteTypes({ root })).toEqual([]);
            expect(exists(root, '.next/types/validator.ts')).toBe(true);
        });
    });

    describe('the CLI', { timeout: 20_000 }, () => {
        const runScript = (root, script) =>
            execFileSync(process.execPath, [script], {
                cwd: root,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });
        const run = (root) => runScript(root, SCRIPT);

        it('says which file it dropped and why', () => {
            const root = makeRoot({
                '.next/types/validator.ts': validator('../../app/gone/page.js')
            });

            const output = run(root);

            expect(output).toContain('.next/types/validator.ts');
            expect(exists(root, '.next/types/validator.ts')).toBe(false);
        });

        it('prints nothing when nothing is stale', () => {
            const root = makeRoot({
                'app/page.tsx': '',
                '.next/types/validator.ts': validator('../../app/page.js')
            });

            expect(run(root)).toBe('');
        });

        // A gate script that only looks like it ran exits 0 having done nothing: the entry check has to
        // hold when the script is reached through a symlink or from a path with `#` or `%` in it.
        it('still runs when it is reached through a symlink', () => {
            const root = makeRoot({
                '.next/types/validator.ts': validator('../../app/gone/page.js')
            });
            const links = makeRoot({});
            const link = path.join(links, 'odd #1 %20.mjs');
            symlinkSync(SCRIPT, link);

            runScript(root, link);

            expect(exists(root, '.next/types/validator.ts')).toBe(false);
        });

        it('still runs from a folder with # and % in its name', () => {
            const root = makeRoot({
                '.next/types/validator.ts': validator('../../app/gone/page.js')
            });
            const folder = path.join(makeRoot({}), 'odd #1 %20');
            mkdirSync(folder);
            copyFileSync(SCRIPT, path.join(folder, 'drop-stale-route-types.mjs'));
            // The copy imports the entry guard from beside itself.
            copyFileSync(
                path.join(path.dirname(SCRIPT), 'is-entry-point.mjs'),
                path.join(folder, 'is-entry-point.mjs')
            );

            runScript(root, path.join(folder, 'drop-stale-route-types.mjs'));

            expect(exists(root, '.next/types/validator.ts')).toBe(false);
        });
    });
});
