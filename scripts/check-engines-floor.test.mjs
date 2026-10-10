// Runner-agnostic on purpose: the templates run their script tests under different runners (vitest
// with globals, or `node --test`). Unlike check-version-holds.test.mjs this file is NOT shared:
// each template implements the check its own way (different exports, different packages counted),
// so the copies differ.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkEnginesFloor, requiredFloor, run } from './check-engines-floor.mjs';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');

// Resolved from the repo root, not from `import.meta.url`: vitest serves this module over its own
// URL scheme, so a URL-relative path cannot work there; `node --test` runs from the root as well.
const SCRIPT = path.resolve(process.cwd(), 'scripts/check-engines-floor.mjs');

/* ------------------------------------------------------------------------ fixtures */

const lockWith = (packages = {}) => ({
    lockfileVersion: 3,
    packages: { '': { name: 'app' }, ...packages }
});

const needs = (range, extra = {}) => ({ version: '1.0.0', engines: { node: range }, ...extra });

const manifestWith = (node) => ({ name: 'app', engines: node === undefined ? {} : { node } });

// The shapes measured in this repository's lockfile on 2026-10-10.
const REAL_LOCK = lockWith({
    'node_modules/jsdom': needs('^22.22.2 || ^24.15.0 || >=26.0.0'),
    'node_modules/@babel/core': needs('^22.18.0 || >=24.11.0'),
    'node_modules/vitest': needs('^20.0.0 || ^22.0.0 || >=24.0.0'),
    'node_modules/execa': needs('^18.19.0 || >=20.5.0'),
    'node_modules/postcss': needs('^10 || ^12 || >=14')
});

/* ------------------------------------------------------------------------ requiredFloor */

describe('requiredFloor', () => {
    it('is the lowest version of the major that every locked engines.node admits', () => {
        const { floor, findings } = requiredFloor(REAL_LOCK, 24);

        assert.deepEqual(floor, [24, 15, 0]);
        assert.deepEqual(findings, []);
    });

    it('is the major itself when no locked package asks for more', () => {
        const lock = lockWith({ 'node_modules/a': needs('>=20') });

        assert.deepEqual(requiredFloor(lock, 24).floor, [24, 0, 0]);
    });

    it('ignores packages that declare no engines.node, and the root entry', () => {
        const lock = lockWith({
            '': { name: 'app', engines: { node: '>=99.0.0' } },
            'node_modules/a': { version: '1.0.0' },
            'node_modules/b': { version: '1.0.0', engines: { npm: '>=10' } }
        });

        assert.deepEqual(requiredFloor(lock, 24).floor, [24, 0, 0]);
    });

    it('lets an upper bound inside the major raise nothing and a lower bound raise it', () => {
        const lock = lockWith({
            'node_modules/a': needs('>=24.3.0 <25'),
            'node_modules/b': needs('^24.1.0')
        });

        assert.deepEqual(requiredFloor(lock, 24).floor, [24, 3, 0]);
    });

    it('has no floor when no version of the major satisfies every package, and names who conflicts', () => {
        const lock = lockWith({
            'node_modules/old': needs('>=20 <24.5.0'),
            'node_modules/new': needs('>=24.9.0')
        });
        const { floor, findings } = requiredFloor(lock, 24);

        assert.equal(floor, null);
        assert.equal(findings.length, 1);
        assert.match(findings[0], /no version of Node 24 satisfies every locked engines\.node/);
        assert.match(findings[0], /node_modules\/old/);
    });

    it('skips a platform package that no version of the major can install, and only that', () => {
        const lock = lockWith({
            'node_modules/@img/sharp-win32-ia32': needs('^20.9.0', {
                os: ['win32'],
                cpu: ['ia32']
            }),
            'node_modules/fsevents': needs('^8.16.0 || >=11.0.0', { os: ['darwin'] }),
            'node_modules/@next/swc-darwin-arm64': needs('>=24.12.0', { os: ['darwin'] })
        });

        assert.deepEqual(requiredFloor(lock, 24).floor, [24, 12, 0]);
    });

    it('still counts a package with no platform restriction that no version of the major satisfies', () => {
        const lock = lockWith({ 'node_modules/legacy': needs('^20.9.0') });

        assert.equal(requiredFloor(lock, 24).floor, null);
    });

    it('refuses a range it cannot read, loudly, instead of guessing', () => {
        const lock = lockWith({ 'node_modules/odd': needs('1.2.3 - 2.3.4') });
        const { findings } = requiredFloor(lock, 24);

        assert.equal(findings.length, 1);
        assert.match(findings[0], /node_modules\/odd/);
        assert.match(findings[0], /1\.2\.3 - 2\.3\.4/);
    });
});

/* ------------------------------------------------------------------------ checkEnginesFloor */

describe('checkEnginesFloor', () => {
    it('passes when engines.node and .nvmrc sit at the floor', () => {
        const { floor, findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.15.0'),
            lock: REAL_LOCK,
            nvmrc: '24.15.0\n'
        });

        assert.deepEqual(floor, [24, 15, 0]);
        assert.deepEqual(findings, []);
    });

    it('passes above the floor, and with a bare major in .nvmrc (nvm takes the newest 24)', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.16.0'),
            lock: REAL_LOCK,
            nvmrc: '24'
        });

        assert.deepEqual(findings, []);
    });

    it('fails an engines.node below a locked package floor, and says what to write', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.0.0'),
            lock: REAL_LOCK,
            nvmrc: '24.15.0'
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /engines\.node ">=24\.0\.0"/);
        assert.match(findings[0], /node_modules\/jsdom/);
        assert.match(findings[0], /node_modules\/@babel\/core/);
        assert.match(findings[0], />=24\.15\.0/);
    });

    it('names the packages that ask for the most first, because they set the floor', () => {
        const lock = lockWith({
            'node_modules/a': needs('>=24.1.0'),
            'node_modules/b': needs('>=24.2.0'),
            'node_modules/c': needs('>=24.3.0'),
            'node_modules/strictest': needs('>=24.15.0')
        });
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.0.0'),
            lock,
            nvmrc: null
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /node_modules\/strictest "[^"]+"/);
        assert.match(findings[0], /and 1 more/);
        assert.doesNotMatch(findings[0], /node_modules\/a "/);
    });

    it('fails a .nvmrc that resolves below the floor', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.15.0'),
            lock: REAL_LOCK,
            nvmrc: '24.11.0'
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /\.nvmrc "24\.11\.0"/);
        assert.match(findings[0], /node_modules\/jsdom/);
    });

    it('fails a .nvmrc written as a minor that the floor outgrew', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.15.0'),
            lock: REAL_LOCK,
            nvmrc: '24.12'
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /\.nvmrc "24\.12"/);
    });

    it('fails a .nvmrc that is not a version, because the floor cannot be read from it', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.15.0'),
            lock: REAL_LOCK,
            nvmrc: 'lts/*'
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /\.nvmrc "lts\/\*" is not a Node version/);
    });

    it('does not require a .nvmrc', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('>=24.15.0'),
            lock: REAL_LOCK,
            nvmrc: null
        });

        assert.deepEqual(findings, []);
    });

    it('fails a package.json with no engines.node, because engine-strict has nothing to enforce', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith(undefined),
            lock: REAL_LOCK,
            nvmrc: null
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /declares no engines\.node/);
    });

    it('fails an engines.node it cannot read', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('24.0.0 - 25.0.0'),
            lock: REAL_LOCK,
            nvmrc: null
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /engines\.node "24\.0\.0 - 25\.0\.0" is not readable/);
    });

    it('fails an engines.node with no lower bound, because there is no floor to compare', () => {
        const { findings } = checkEnginesFloor({
            manifest: manifestWith('<26'),
            lock: REAL_LOCK,
            nvmrc: null
        });

        assert.equal(findings.length, 1);
        assert.match(findings[0], /no lower bound/);
    });

    it('checks the major engines.node declares, not a fixed one', () => {
        const lock = lockWith({ 'node_modules/a': needs('^22.5.0 || >=24') });
        const { floor, findings } = checkEnginesFloor({
            manifest: manifestWith('>=22.0.0'),
            lock,
            nvmrc: null
        });

        assert.deepEqual(floor, [22, 5, 0]);
        assert.equal(findings.length, 1);
        assert.match(findings[0], />=22\.5\.0/);
    });
});

/* ------------------------------------------------------------------------ run and CLI */

const tmpRoot = (files) => {
    const root = mkdtempSync(path.join(tmpdir(), 'engines-floor-'));
    for (const [name, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        writeFileSync(path.join(root, name), content);
    }
    return root;
};

describe('run', () => {
    it('reads package.json, package-lock.json and .nvmrc from the root', () => {
        const root = tmpRoot({
            'package.json': JSON.stringify(manifestWith('>=24.0.0')),
            'package-lock.json': JSON.stringify(REAL_LOCK),
            '.nvmrc': '24\n'
        });
        try {
            const { floor, findings } = run({ root });

            assert.deepEqual(floor, [24, 15, 0]);
            assert.equal(findings.length, 1);
            assert.match(findings[0], /engines\.node/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it('treats a missing .nvmrc as absent and a missing lockfile as a finding', () => {
        const root = tmpRoot({ 'package.json': JSON.stringify(manifestWith('>=24.15.0')) });
        try {
            const { findings } = run({ root });

            assert.equal(findings.length, 1);
            assert.match(findings[0], /package-lock\.json cannot be read/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('command line', () => {
    const cli = (files) => {
        const root = tmpRoot(files);
        try {
            return spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    };

    it('exits 0 and names the floor when the declaration holds', () => {
        const result = cli({
            'package.json': JSON.stringify(manifestWith('>=24.15.0')),
            'package-lock.json': JSON.stringify(REAL_LOCK),
            '.nvmrc': '24.15.0\n'
        });

        assert.equal(result.status, 0);
        assert.match(result.stdout, /24\.15\.0/);
    });

    it('exits 1 and prints the finding when engines.node is below the floor', () => {
        const result = cli({
            'package.json': JSON.stringify(manifestWith('>=24.0.0')),
            'package-lock.json': JSON.stringify(REAL_LOCK)
        });

        assert.equal(result.status, 1);
        assert.match(result.stdout, /✖ engines\.node ">=24\.0\.0"/);
    });
});
