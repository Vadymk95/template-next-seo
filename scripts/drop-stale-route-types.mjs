#!/usr/bin/env node
/**
 * drop-stale-route-types - runs before `tsc` in `npm run typecheck`.
 *
 * Next writes type files that import the route modules themselves: `<dist>/types/validator.ts`
 * (`<dist>/dev/types/validator.ts` under `next dev`) and, after a build, one stub per route under
 * `<dist>/types/app/`. It rewrites them only while `next dev` or a build runs, so deleting or
 * renaming a route leaves a file naming a module that is gone, and `tsc` fails with TS2307 on a file
 * nobody edited until a live dev server regenerates it. The tsconfig includes those folders, and
 * Next puts the entries back if they are removed, so the stale file goes instead.
 *
 * Only a file that imports a missing module is removed: a current one keeps validating route
 * exports. What the files add is that check alone, and Next writes them again whenever it runs.
 * The declaration files beside them (`routes.d.ts`, `root-params.d.ts`, `cache-life.d.ts`) are
 * never touched: `next-env.d.ts` imports them.
 *
 * Usage (from the repository root): node scripts/drop-stale-route-types.mjs
 */
import { existsSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The output folders tsconfig.json includes (`.next-dev` is the dev smoke's), and where each keeps types.
const DIST_DIRS = ['.next', '.next-dev'];
const TYPE_DIRS = ['types', path.join('dev', 'types')];
// What a route module can be called on disk when a generated import spells it `.js`.
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.jsx', '.js'];
// A relative import in either shape Next writes: `from '../app/x.js'` and `import('../app/x.js')`.
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\1/g;

const moduleExists = (target) =>
    existsSync(target) ||
    SOURCE_EXTENSIONS.some((extension) => existsSync(target.replace(/\.js$/, extension)));

const isInside = (folder, target) => {
    const relative = path.relative(folder, target);

    return !relative.startsWith('..') && !path.isAbsolute(relative);
};

/** Whether a generated type file imports a module outside its output folder that is no longer there. */
const namesMissingModule = ({ file, distDir }) =>
    [...readFileSync(file, 'utf8').matchAll(RELATIVE_IMPORT)]
        .map((match) => path.resolve(path.dirname(file), match[2]))
        // `./routes.js` and its siblings are generated declarations inside the output folder: not routes.
        .filter((target) => !isInside(distDir, target))
        .some((target) => !moduleExists(target));

const generatedTypeFiles = (typeDir) =>
    existsSync(typeDir)
        ? readdirSync(typeDir, { recursive: true })
              .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
              .map((name) => path.join(typeDir, name))
        : [];

/** Removes the stale generated type files under `root`; returns what it removed, relative to `root`. */
export const dropStaleRouteTypes = ({ root }) => {
    const dropped = [];
    for (const dist of DIST_DIRS) {
        const distDir = path.join(root, dist);
        for (const typeDir of TYPE_DIRS) {
            for (const file of generatedTypeFiles(path.join(distDir, typeDir))) {
                if (!namesMissingModule({ file, distDir })) continue;
                rmSync(file);
                dropped.push(path.relative(root, file));
            }
        }
    }

    return dropped;
};

const main = () => {
    for (const file of dropStaleRouteTypes({ root: process.cwd() })) {
        console.log(`drop-stale-route-types: removed ${file} (it names a route that is gone)`);
    }
};

// Entry point only. Resolving the real path and encoding it keeps the check true through a symlink and
// for a path with `#` or `%` in it, where a plain string comparison skipped `main` and exited 0.
if (
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
    main();
}
