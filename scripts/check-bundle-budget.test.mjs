import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
    brotliBytes,
    checkBudgets,
    firstLoadFiles,
    measureBuild,
    parseBudgets,
    publicRoutes,
    readClientManifestEntry,
    routeJsFiles,
    sharedJsFiles
} from './check-bundle-budget.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-bundle-budget.mjs');
const REAL_BUDGETS = join(dirname(fileURLToPath(import.meta.url)), 'bundle-budget.json');
const KB = 1024;
const EXCLUDE = ['/_not-found', '/_global-error', '/dev'];

// Incompressible bytes, so a fixture's brotli size is predictable and a test can place a file exactly
// on a budget line.
const randomBytes = (length, seed) => {
    const out = Buffer.alloc(length);
    let state = seed;
    for (let i = 0; i < length; i += 1) {
        state = (state ^ (state << 13)) >>> 0;
        state = (state ^ (state >>> 17)) >>> 0;
        state = (state ^ (state << 5)) >>> 0;
        out[i] = state & 0xff;
    }
    return out;
};

// A file whose brotli size is EXACTLY `target` bytes.
const bytesWithBrotliSize = (target, seed) => {
    for (let length = target - 16; length <= target; length += 1) {
        const candidate = randomBytes(length, seed);
        if (brotliCompressSync(candidate).length === target) return candidate;
    }
    throw new Error(`no fixture of brotli size ${String(target)}`);
};

// The measured shape of a webpack build's client reference manifest (Next 16): a script that assigns
// one entry, whose `clientModules[*].chunks` alternate chunk id and chunk path, with the path
// URL-encoded. `entryJSFiles` is absent from a webpack build.
const manifestSource = (appPath, entry) =>
    `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST[${JSON.stringify(appPath)}]=${JSON.stringify(entry)}`;

const clientModules = (...chunkLists) =>
    Object.fromEntries(
        chunkLists.map((chunks, i) => [`/repo/mod${String(i)}.tsx`, { id: i, name: '*', chunks }])
    );

const dirs = [];
const tempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    dirs.push(dir);
    return dir;
};

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const put = (root, path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};

/**
 * A fake `.next`. `shared` and each route's `chunks` map a path to its bytes; a route lists its chunks
 * in `clientModules` the way the real manifest does.
 */
const makeBuild = ({ shared, routes, polyfill = 'static/chunks/polyfills.js' }) => {
    const root = tempDir();
    const sharedPaths = Object.keys(shared);
    put(
        root,
        'build-manifest.json',
        JSON.stringify({
            polyfillFiles: [polyfill],
            rootMainFiles: [...sharedPaths, 'static/css/app.css']
        })
    );
    put(root, polyfill, randomBytes(2000, 7));
    put(root, 'static/css/app.css', randomBytes(3000, 9));
    for (const [path, bytes] of Object.entries(shared)) put(root, path, bytes);

    const appPaths = {};
    for (const [appPath, { chunks, files = {}, extra = {} }] of Object.entries(routes)) {
        appPaths[appPath] = appPath.replace(/\/page$/, '') || '/';
        for (const [path, bytes] of Object.entries(files)) put(root, path, bytes);
        put(
            root,
            `server/app${appPath}_client-reference-manifest.js`,
            manifestSource(appPath, { clientModules: clientModules(...chunks), ...extra })
        );
    }
    put(root, 'app-path-routes-manifest.json', JSON.stringify(appPaths));
    return root;
};

const budgetsFile = (sharedKb, heaviestKb) => {
    const dir = tempDir();
    put(
        dir,
        'budget.json',
        JSON.stringify({
            excludeRoutes: EXCLUDE,
            limitsKb: { sharedFirstLoad: sharedKb, heaviestRouteFirstLoad: heaviestKb }
        })
    );
    return join(dir, 'budget.json');
};

describe('sharedJsFiles', () => {
    it('keeps only the JS of rootMainFiles: no css, and the nomodule polyfills are not in it', () => {
        const manifest = {
            polyfillFiles: ['static/chunks/polyfills-1.js'],
            rootMainFiles: [
                'static/chunks/webpack-1.js',
                'static/chunks/main-app-1.js',
                'static/css/a.css'
            ]
        };

        expect(sharedJsFiles(manifest)).toEqual([
            'static/chunks/webpack-1.js',
            'static/chunks/main-app-1.js'
        ]);
    });

    it('refuses a manifest with no shared JS: it would measure 0 and pass', () => {
        expect(() => sharedJsFiles({ rootMainFiles: ['static/css/a.css'] })).toThrow(
            /no shared JS/
        );
        expect(() => sharedJsFiles({})).toThrow(/no shared JS/);
    });
});

describe('routeJsFiles', () => {
    it('reads the JS out of clientModules: ids and css skipped, paths decoded, query stripped', () => {
        const entry = {
            clientModules: clientModules(
                ['177', 'static/chunks/app/layout-1.js'],
                ['450', 'static/chunks/app/%5Blocale%5D/layout-2.js?dpl=abc', 'static/css/x.css']
            )
        };

        expect(routeJsFiles(entry)).toEqual([
            'static/chunks/app/layout-1.js',
            'static/chunks/app/[locale]/layout-2.js'
        ]);
    });

    it('counts a chunk listed by several modules once', () => {
        const entry = {
            clientModules: clientModules(
                ['1', 'static/chunks/common.js'],
                ['1', 'static/chunks/common.js', '2', 'static/chunks/ui.js'],
                ['2', 'static/chunks/ui.js']
            )
        };

        expect(routeJsFiles(entry)).toEqual(['static/chunks/common.js', 'static/chunks/ui.js']);
    });

    it('also reads entryJSFiles when a build provides it, without double counting', () => {
        const entry = {
            clientModules: clientModules(['1', 'static/chunks/common.js']),
            entryJSFiles: {
                '/app/page': ['static/chunks/common.js', 'static/chunks/page.js'],
                '/app/layout': ['static/chunks/page.js', 'static/css/y.css']
            }
        };

        expect(routeJsFiles(entry).sort()).toEqual([
            'static/chunks/common.js',
            'static/chunks/page.js'
        ]);
    });
});

describe('firstLoadFiles', () => {
    it('is the union of shared and route files, each once', () => {
        expect(firstLoadFiles(['a.js', 'b.js'], ['b.js', 'c.js', 'c.js', 'a.js'])).toEqual([
            'a.js',
            'b.js',
            'c.js'
        ]);
    });
});

describe('publicRoutes', () => {
    const manifest = {
        '/[locale]/page': '/[locale]',
        '/[locale]/example-form/page': '/[locale]/example-form',
        '/_not-found/page': '/_not-found',
        '/_global-error/page': '/_global-error',
        '/dev/ui/page': '/dev/ui',
        '/dev/ui/content-stress/page': '/dev/ui/content-stress',
        '/devices/page': '/devices',
        '/api/health/route': '/api/health',
        '/robots.txt/route': '/robots.txt'
    };

    it('keeps pages, drops route handlers and the excluded routes (and everything under them)', () => {
        expect(publicRoutes(manifest, EXCLUDE).map((r) => r.route)).toEqual([
            '/[locale]',
            '/[locale]/example-form',
            '/devices'
        ]);
    });

    it('maps each route to the app path its manifest is stored under', () => {
        expect(publicRoutes(manifest, EXCLUDE)[0]).toEqual({
            route: '/[locale]',
            appPath: '/[locale]/page'
        });
    });

    it('names the root page "/" rather than an empty string', () => {
        expect(publicRoutes({ '/page': '/' }, EXCLUDE)).toEqual([{ route: '/', appPath: '/page' }]);
    });
});

describe('readClientManifestEntry', () => {
    it('evaluates the manifest script and returns its entry for the app path', () => {
        const source = manifestSource('/[locale]/page', { clientModules: {} });

        expect(readClientManifestEntry(source, '/[locale]/page')).toEqual({ clientModules: {} });
    });

    it('refuses a manifest that has no entry for the route', () => {
        const source = manifestSource('/other/page', { clientModules: {} });

        expect(() => readClientManifestEntry(source, '/[locale]/page')).toThrow(
            /\/\[locale\]\/page/
        );
    });

    it('refuses a manifest with no clientModules: nothing would be measured', () => {
        const source = manifestSource('/[locale]/page', {});

        expect(() => readClientManifestEntry(source, '/[locale]/page')).toThrow(/clientModules/);
    });
});

describe('brotliBytes', () => {
    it('is the brotli-compressed length, not the file length', () => {
        const compressible = Buffer.from('a'.repeat(5000));

        expect(brotliBytes(compressible)).toBe(brotliCompressSync(compressible).length);
        expect(brotliBytes(compressible)).toBeLessThan(100);
    });
});

describe('measureBuild', () => {
    const shared = {
        'static/chunks/webpack.js': randomBytes(1500, 1),
        'static/chunks/main-app.js': randomBytes(2500, 2)
    };
    const sizeOf = (bytes) => brotliCompressSync(bytes).length;

    it('measures shared JS only: not the css, not the polyfills', () => {
        const root = makeBuild({
            shared,
            routes: {
                '/[locale]/page': {
                    chunks: [['1', 'static/chunks/common.js']],
                    files: { 'static/chunks/common.js': randomBytes(900, 3) }
                }
            }
        });

        const result = measureBuild(root, { excludeRoutes: EXCLUDE });

        expect(result.sharedBytes).toBe(
            sizeOf(shared['static/chunks/webpack.js']) + sizeOf(shared['static/chunks/main-app.js'])
        );
    });

    it('counts a route whose chunks appear twice, and a chunk it shares with rootMainFiles, once', () => {
        const page = randomBytes(800, 4);
        const root = makeBuild({
            shared,
            routes: {
                '/[locale]/page': {
                    chunks: [
                        ['1', 'static/chunks/page.js'],
                        ['1', 'static/chunks/page.js', '2', 'static/chunks/main-app.js'],
                        ['3', 'static/chunks/page.js']
                    ],
                    files: { 'static/chunks/page.js': page }
                }
            }
        });

        const [route] = measureBuild(root, { excludeRoutes: EXCLUDE }).routes;

        expect(route.files.toSorted()).toEqual([
            'static/chunks/main-app.js',
            'static/chunks/page.js',
            'static/chunks/webpack.js'
        ]);
        expect(route.bytes).toBe(
            sizeOf(shared['static/chunks/webpack.js']) +
                sizeOf(shared['static/chunks/main-app.js']) +
                sizeOf(page)
        );
    });

    it('measures every public route and leaves the excluded ones out', () => {
        const root = makeBuild({
            shared,
            routes: {
                '/[locale]/page': {
                    chunks: [['1', 'static/chunks/a.js']],
                    files: { 'static/chunks/a.js': randomBytes(600, 5) }
                },
                '/dev/ui/page': {
                    chunks: [['1', 'static/chunks/huge.js']],
                    files: { 'static/chunks/huge.js': randomBytes(90000, 6) }
                }
            }
        });

        const result = measureBuild(root, { excludeRoutes: EXCLUDE });

        expect(result.routes.map((r) => r.route)).toEqual(['/[locale]']);
    });

    it('fails closed when a listed chunk is not on disk', () => {
        const root = makeBuild({
            shared,
            routes: { '/[locale]/page': { chunks: [['1', 'static/chunks/gone.js']] } }
        });

        expect(() => measureBuild(root, { excludeRoutes: EXCLUDE })).toThrow(/gone\.js/);
    });

    it('fails closed when there is no build at all', () => {
        expect(() => measureBuild(join(tempDir(), '.next'), { excludeRoutes: EXCLUDE })).toThrow(
            /build-manifest\.json/
        );
    });

    it('fails closed when no public route is left to measure', () => {
        const root = makeBuild({
            shared,
            routes: {
                '/dev/ui/page': {
                    chunks: [['1', 'static/chunks/a.js']],
                    files: { 'static/chunks/a.js': randomBytes(10, 8) }
                }
            }
        });

        expect(() => measureBuild(root, { excludeRoutes: EXCLUDE })).toThrow(/no public route/);
    });

    it('fails closed when a public route has no client reference manifest', () => {
        const root = makeBuild({
            shared,
            routes: {
                '/[locale]/page': {
                    chunks: [['1', 'static/chunks/a.js']],
                    files: { 'static/chunks/a.js': randomBytes(10, 8) }
                }
            }
        });
        rmSync(join(root, 'server/app/[locale]/page_client-reference-manifest.js'));

        expect(() => measureBuild(root, { excludeRoutes: EXCLUDE })).toThrow(
            /page_client-reference-manifest/
        );
    });
});

describe('checkBudgets', () => {
    const budgets = { sharedKb: 10, heaviestRouteKb: 20 };
    const within = {
        sharedBytes: 10 * KB,
        routes: [
            { route: '/a', files: [], bytes: 12 * KB },
            { route: '/b', files: [], bytes: 20 * KB }
        ]
    };

    it('passes a build exactly on both limits', () => {
        expect(checkBudgets(within, budgets).failures).toEqual([]);
    });

    it('fails the shared budget by one byte', () => {
        const { failures } = checkBudgets({ ...within, sharedBytes: 10 * KB + 1 }, budgets);

        expect(failures).toHaveLength(1);
        expect(failures[0]).toMatch(/shared first-load JS/);
    });

    it('fails the route budget by one byte and names the heaviest route', () => {
        const { failures } = checkBudgets(
            {
                ...within,
                routes: [within.routes[0], { route: '/b', files: [], bytes: 20 * KB + 1 }]
            },
            budgets
        );

        expect(failures).toHaveLength(1);
        expect(failures[0]).toMatch(/\/b/);
    });

    it('judges the heaviest route, whichever it is', () => {
        const { failures } = checkBudgets(
            {
                ...within,
                routes: [{ route: '/a', files: [], bytes: 20 * KB + 1 }, within.routes[0]]
            },
            budgets
        );

        expect(failures).toHaveLength(1);
        expect(failures[0]).toMatch(/\/a/);
    });

    it('reports both failures when both limits are broken', () => {
        const over = {
            sharedBytes: 11 * KB,
            routes: [{ route: '/a', files: [], bytes: 21 * KB }]
        };

        expect(checkBudgets(over, budgets).failures).toHaveLength(2);
    });

    it('prints one row per route plus the shared line', () => {
        expect(checkBudgets(within, budgets).rows).toHaveLength(3);
    });
});

describe('parseBudgets', () => {
    const valid = {
        excludeRoutes: ['/dev'],
        limitsKb: { sharedFirstLoad: 100, heaviestRouteFirstLoad: 200 }
    };

    it('reads the limits and the excluded routes', () => {
        expect(parseBudgets(valid)).toEqual({
            excludeRoutes: ['/dev'],
            sharedKb: 100,
            heaviestRouteKb: 200
        });
    });

    it.each([
        ['a missing limit', { ...valid, limitsKb: { sharedFirstLoad: 100 } }],
        [
            'a zero limit',
            { ...valid, limitsKb: { sharedFirstLoad: 0, heaviestRouteFirstLoad: 200 } }
        ],
        [
            'a fractional limit',
            { ...valid, limitsKb: { sharedFirstLoad: 1.5, heaviestRouteFirstLoad: 200 } }
        ],
        [
            'a string limit',
            { ...valid, limitsKb: { sharedFirstLoad: '100', heaviestRouteFirstLoad: 200 } }
        ],
        ['no excludeRoutes', { limitsKb: valid.limitsKb }],
        ['an exclusion without a leading slash', { ...valid, excludeRoutes: ['dev'] }]
    ])('refuses %s', (_name, value) => {
        expect(() => parseBudgets(value)).toThrow();
    });

    it('accepts the budget file this repo ships', async () => {
        const { readFileSync } = await import('node:fs');
        const real = parseBudgets(JSON.parse(readFileSync(REAL_BUDGETS, 'utf8')));

        expect(real.sharedKb).toBeGreaterThan(0);
        expect(real.heaviestRouteKb).toBeGreaterThanOrEqual(real.sharedKb);
        expect(real.excludeRoutes).toContain('/dev');
    });
});

describe('CLI', () => {
    const run = (dist, budgets) =>
        spawnSync(process.execPath, [SCRIPT, dist, budgets], { encoding: 'utf8' });

    // Exactly 1 KB of shared JS and exactly 2 KB on the heaviest route.
    const exactBuild = (sharedBytes) =>
        makeBuild({
            shared: { 'static/chunks/main-app.js': sharedBytes },
            routes: {
                '/[locale]/page': {
                    chunks: [['1', 'static/chunks/page.js']],
                    files: { 'static/chunks/page.js': bytesWithBrotliSize(KB, 12) }
                }
            }
        });

    it('exits 0 for a build exactly on the budget', () => {
        const result = run(exactBuild(bytesWithBrotliSize(KB, 11)), budgetsFile(1, 2));

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('/[locale]');
    });

    it('exits 1, naming the budget, for a build one byte over', () => {
        const result = run(exactBuild(bytesWithBrotliSize(KB + 1, 11)), budgetsFile(1, 3));

        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/shared first-load JS/);
    });

    it('exits 1 when there is no build to measure', () => {
        const result = run(join(tempDir(), '.next'), budgetsFile(1, 2));

        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/build-manifest\.json/);
    });
});
