#!/usr/bin/env node
/**
 * A first-load JS budget for the PUBLIC routes of a production build, computed from Next's own
 * manifests. Zero dependencies: node's `zlib` and `vm`, nothing from npm.
 *
 * Why it is not "the size of .next/static/chunks": an App Router visitor downloads the chunks shared by
 * every route plus that route's own client chunks. Server components ship no JS, and most files in the
 * chunks directory are never fetched together. Next 16 no longer prints a "First Load JS" table, so the
 * number is rebuilt from the manifests the build leaves behind:
 *
 *   shared first-load JS = the JS in `build-manifest.json` `rootMainFiles` (the webpack runtime, the
 *                          vendor chunks, main-app). `polyfillFiles` load only in legacy browsers
 *                          (nomodule) and the css is not JS: neither counts.
 *   route first-load JS  = the shared JS + that route's own client chunks, each file once.
 *
 * Where a route's own chunks are, measured on a `next build --webpack` of this template: NOT in
 * `entryJSFiles` (only a Turbopack build fills it) but in `clientModules[*].chunks` of
 * `server/app/<route>/page_client-reference-manifest.js`, and that set matched the scripts the
 * prerendered HTML of both public routes loads, file for file. `entryJSFiles` is read too, so a build
 * that provides it is counted the same way.
 *
 * Sizes are brotli (`zlib.brotliCompressSync`, default quality), the transfer size, and 1 KB = 1024
 * bytes. Limits live in `scripts/bundle-budget.json`: measured + at most 10%, rounded up to a whole KB,
 * with the measurement recorded in `.cursor/brain/DECISIONS.md`.
 *
 * Fail closed: a missing manifest, a chunk that is not on disk, no public route or an empty shared set
 * is an error, never a pass over fewer files than the build has.
 *
 * Usage:
 *   node scripts/check-bundle-budget.mjs [distDir] [budgetFile]
 *   distDir defaults to $NEXT_DIST_DIR, then `.next`; budgetFile to scripts/bundle-budget.json.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { brotliCompressSync } from 'node:zlib';

const KB = 1024;
const DEFAULT_BUDGETS = join(dirname(fileURLToPath(import.meta.url)), 'bundle-budget.json');
const PAGE_SUFFIX = '/page';

const stripQuery = (path) => path.split('?')[0];
const isJs = (path) => stripQuery(path).endsWith('.js');
// Chunk paths in the client reference manifest are URL-encoded (`%5Blocale%5D`) and carry a
// `?dpl=<id>` suffix when a deployment id is set; the files on disk are neither.
const toFilePath = (path) => decodeURIComponent(stripQuery(path));

/** The JS every route loads. Throws on an empty set: a budget over nothing would always pass. */
export const sharedJsFiles = (buildManifest) => {
    const files = (buildManifest.rootMainFiles ?? []).filter(isJs);
    if (files.length === 0) {
        throw new Error('build-manifest.json lists no shared JS in rootMainFiles');
    }
    return files;
};

/** A route's own client chunks, each once. Chunk lists alternate chunk id and chunk path. */
export const routeJsFiles = (entry) => {
    const listed = [
        ...Object.values(entry.clientModules ?? {}).flatMap((module) => module.chunks ?? []),
        ...Object.values(entry.entryJSFiles ?? {}).flat()
    ];
    return [...new Set(listed.filter(isJs).map(toFilePath))];
};

/** What a visit to one route downloads: shared and route files, a file listed twice counted once. */
export const firstLoadFiles = (sharedFiles, routeFiles) => [
    ...new Set([...sharedFiles, ...routeFiles])
];

/**
 * The routes the budget judges: every page of the build except the excluded routes and everything
 * under them. Discovered, not listed, so a route a fork adds is inside the budget by default.
 */
export const publicRoutes = (appPathRoutes, excludeRoutes) =>
    Object.keys(appPathRoutes)
        .filter((appPath) => appPath.endsWith(PAGE_SUFFIX))
        .map((appPath) => ({
            route: appPath.slice(0, -PAGE_SUFFIX.length) || '/',
            appPath
        }))
        .filter(
            ({ route }) =>
                !excludeRoutes.some(
                    (excluded) => route === excluded || route.startsWith(`${excluded}/`)
                )
        )
        .toSorted((a, b) => a.route.localeCompare(b.route));

/**
 * The manifest is a script that assigns `globalThis.__RSC_MANIFEST[<app path>]`, so it is evaluated
 * in an empty context (what Next's own bundle-stats code does with `require`, minus the shared global).
 */
export const readClientManifestEntry = (source, appPath) => {
    const context = {};
    runInNewContext(source, context);
    const entry = context.__RSC_MANIFEST?.[appPath];
    if (!entry) {
        throw new Error(`client reference manifest has no entry for ${appPath}`);
    }
    if (!entry.clientModules) {
        throw new Error(`client reference manifest entry for ${appPath} has no clientModules`);
    }
    return entry;
};

export const brotliBytes = (bytes) => brotliCompressSync(bytes).length;

const readFileIn = (distDir, relativePath) => {
    try {
        return readFileSync(join(distDir, relativePath));
    } catch (cause) {
        throw new Error(`cannot read ${relativePath} in ${distDir}`, { cause });
    }
};

/** Reads the build's manifests and files and returns the brotli bytes of the shared set and each public route. */
export const measureBuild = (distDir, { excludeRoutes }) => {
    const readJson = (relativePath) => JSON.parse(readFileIn(distDir, relativePath).toString());
    const shared = sharedJsFiles(readJson('build-manifest.json'));
    const routes = publicRoutes(readJson('app-path-routes-manifest.json'), excludeRoutes);
    if (routes.length === 0) {
        throw new Error('no public route to measure in app-path-routes-manifest.json');
    }

    // A chunk shared by several routes is compressed once.
    const sizes = new Map();
    const sizeOf = (file) => {
        if (!sizes.has(file)) sizes.set(file, brotliBytes(readFileIn(distDir, file)));
        return sizes.get(file);
    };
    const total = (files) => files.reduce((sum, file) => sum + sizeOf(file), 0);

    return {
        sharedBytes: total(shared),
        routes: routes.map(({ route, appPath }) => {
            const manifest = readFileIn(
                distDir,
                `server/app${appPath}_client-reference-manifest.js`
            ).toString();
            const files = firstLoadFiles(
                shared,
                routeJsFiles(readClientManifestEntry(manifest, appPath))
            );
            return { route, files, bytes: total(files) };
        })
    };
};

const formatKb = (bytes) => `${(bytes / KB).toFixed(2)} KB`;

/** Compares a measurement with the limits. `failures` empty means within budget; `rows` is the report. */
export const checkBudgets = ({ sharedBytes, routes }, { sharedKb, heaviestRouteKb }) => {
    const [heaviest] = routes.toSorted((a, b) => b.bytes - a.bytes);
    if (!heaviest) {
        throw new Error('no route was measured');
    }

    const failures = [];
    if (sharedBytes > sharedKb * KB) {
        failures.push(
            `shared first-load JS is ${formatKb(sharedBytes)}, over its ${String(sharedKb)} KB budget`
        );
    }
    if (heaviest.bytes > heaviestRouteKb * KB) {
        failures.push(
            `heaviest route ${heaviest.route} first-load JS is ${formatKb(heaviest.bytes)}, over its ${String(heaviestRouteKb)} KB budget`
        );
    }

    const rows = [
        `shared first-load JS  ${formatKb(sharedBytes)}  (budget ${String(sharedKb)} KB)`,
        ...routes.map(
            ({ route, bytes }) =>
                `${route === heaviest.route ? 'heaviest route' : 'route'}  ${route}  ${formatKb(bytes)}${
                    route === heaviest.route ? `  (budget ${String(heaviestRouteKb)} KB)` : ''
                }`
        )
    ];
    return { failures, rows };
};

const isWholeKb = (value) => Number.isInteger(value) && value > 0;

/** Validates the budget file: a typo there must fail the gate, not silently disable it. */
export const parseBudgets = (budgets) => {
    const { excludeRoutes, limitsKb } = budgets;
    if (
        !Array.isArray(excludeRoutes) ||
        !excludeRoutes.every((route) => typeof route === 'string' && route.startsWith('/'))
    ) {
        throw new Error(
            'bundle-budget.json: excludeRoutes must be a list of routes starting with "/"'
        );
    }
    const { sharedFirstLoad, heaviestRouteFirstLoad } = limitsKb ?? {};
    if (!isWholeKb(sharedFirstLoad) || !isWholeKb(heaviestRouteFirstLoad)) {
        throw new Error(
            'bundle-budget.json: limitsKb.sharedFirstLoad and limitsKb.heaviestRouteFirstLoad must be whole KB, above 0'
        );
    }
    return { excludeRoutes, sharedKb: sharedFirstLoad, heaviestRouteKb: heaviestRouteFirstLoad };
};

const main = () => {
    const [distArg, budgetArg = DEFAULT_BUDGETS] = process.argv.slice(2);
    const distDir = resolve(distArg ?? process.env.NEXT_DIST_DIR ?? '.next');

    try {
        const budgets = parseBudgets(JSON.parse(readFileSync(budgetArg, 'utf8')));
        const { failures, rows } = checkBudgets(measureBuild(distDir, budgets), budgets);

        for (const row of rows) console.log(row);
        for (const failure of failures) console.error(`✖ ${failure}`);
        if (failures.length > 0) process.exitCode = 1;
    } catch (error) {
        console.error(`✖ bundle budget: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
};

// Guarded so importing this module for a test does not measure a build.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
