#!/usr/bin/env node
/**
 * engines-floor — the Node floor this repo declares is not below what its lockfile needs.
 *
 * Why it exists: `.npmrc` sets `engine-strict=true`, so `npm ci` refuses a Node outside the
 * `engines.node` of ANY installed package, but `package.json` declared `>=24.0.0` while the lockfile
 * held `jsdom` (`^24.15.0`) and `@babel/core` (`>=24.11.0`). A Node 24.0.0 to 24.10.x passed the
 * declaration and then failed the install: the floor on paper was lower than the floor in fact, and
 * it moves with every dependency bump, so a number written by hand goes stale without a diff
 * touching it. This check computes the floor from the lockfile and fails when a declaration is lower.
 *
 * Findings (each printed on its own line; exit 1 when any exists):
 *   engines.node   the lowest version `package.json` admits fails a locked package's `engines.node`
 *                  (or `engines.node` is absent, unreadable, or has no lower bound)
 *   .nvmrc         the version `nvm use` resolves to fails one (a bare `24` counts as the newest 24,
 *                  which is what nvm installs; `24.12` as the newest 24.12.x); not a version at all
 *   lockfile       no version of the major satisfies every locked package, or a range is unreadable
 *
 * What counts: every `packages` entry of the lockfile except the root, dev and optional ones included
 * (`engine-strict` checks all that are installed). One exception: a package with `os` or `cpu` that no
 * version of the major satisfies is skipped, because on its platform the install fails regardless of
 * what is declared here (`@img/sharp-win32-ia32` asks for `^20.9.0`, and Node has no 32-bit Windows 24).
 *
 * Ranges are read by the parser in check-version-holds.mjs: comparators, `^`, `~`, x-ranges, `||`;
 * a hyphen range or anything else is refused loudly rather than guessed. No other dependencies, on
 * purpose: this runs before anything is built.
 *
 * Usage: node scripts/check-engines-floor.mjs [--root <dir>]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { inRange, parseRange } from './check-version-holds.mjs';

const MAX_PART = Number.MAX_SAFE_INTEGER;
const SHOWN = 3;

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const show = (version) => version.join('.');

/** Some version of `major` (>= major.0.0, < major+1.0.0) is inside the intervals. */
const admitsMajor = (intervals, major) =>
    intervals.some(
        (interval) =>
            (interval.hi === null || compare(interval.hi, [major, 0, 0]) > 0) &&
            (interval.lo === null || compare(interval.lo, [major + 1, 0, 0]) < 0)
    );

/** The `engines.node` of every locked package that counts towards the floor of `major`. */
const lockedRanges = (lock, major) => {
    const ranges = [];
    const findings = [];
    for (const [name, entry] of Object.entries(lock.packages ?? {})) {
        const range = entry?.engines?.node;
        if (name === '' || typeof range !== 'string') continue;
        let intervals;
        try {
            intervals = parseRange(range);
        } catch (error) {
            findings.push(`${name}: engines.node "${range}" is not readable (${error.message})`);
            continue;
        }
        if ((entry.os || entry.cpu) && !admitsMajor(intervals, major)) continue;
        ranges.push({ name, range, intervals });
    }
    return { ranges, findings };
};

const rejecting = (ranges, version) =>
    ranges.filter(({ intervals }) => !inRange(intervals, version));

/** The lowest version of `major` the intervals admit (the next major's first when none). */
const lowestIn = (intervals, major) =>
    intervals
        .filter((interval) => admitsMajor([interval], major))
        .map((interval) =>
            interval.lo !== null && compare(interval.lo, [major, 0, 0]) > 0
                ? interval.lo
                : [major, 0, 0]
        )
        .sort(compare)[0] ?? [major + 1, 0, 0];

/** Names the packages that ask for the most first: they are the ones that set the floor. */
const describeRejecting = (rejected, major) => {
    const strictestFirst = [...rejected].sort((a, b) =>
        compare(lowestIn(b.intervals, major), lowestIn(a.intervals, major))
    );
    const listed = strictestFirst
        .slice(0, SHOWN)
        .map(({ name, range }) => `${name} "${range}"`)
        .join(', ');
    const rest = rejected.length - SHOWN;
    return rest > 0 ? `${listed} and ${String(rest)} more` : listed;
};

/**
 * The lowest version of `major` every locked `engines.node` admits, or null when none does. A
 * satisfying set can only start at `major.0.0` or at the lower bound of some range, so those are the
 * only candidates.
 */
export const requiredFloor = (lock, major) => {
    const { ranges, findings } = lockedRanges(lock, major);
    const candidates = [[major, 0, 0]];
    for (const { intervals } of ranges) {
        for (const { lo } of intervals) {
            if (lo !== null && lo[0] === major) candidates.push(lo);
        }
    }
    candidates.sort(compare);
    const floor = candidates.find((candidate) => rejecting(ranges, candidate).length === 0) ?? null;
    if (floor === null && findings.length === 0) {
        const conflict = rejecting(ranges, candidates.at(-1));
        findings.push(
            `lockfile: no version of Node ${String(major)} satisfies every locked engines.node (${describeRejecting(conflict, major)})`
        );
    }
    return { floor, findings };
};

/** What `nvm use` lands on: a bare `24` is the newest 24, `24.12` the newest 24.12. */
const nvmrcVersion = (text) => {
    const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(text);
    if (!match) return null;
    return [Number(match[1]), Number(match[2] ?? MAX_PART), Number(match[3] ?? MAX_PART)];
};

/** All findings for a manifest against the lockfile and the optional `.nvmrc` text. */
export const checkEnginesFloor = ({ manifest, lock, nvmrc }) => {
    const declared = manifest?.engines?.node;
    if (typeof declared !== 'string') {
        return {
            floor: null,
            findings: [
                'package.json declares no engines.node, so engine-strict has nothing to enforce'
            ]
        };
    }
    let declaredIntervals;
    try {
        declaredIntervals = parseRange(declared);
    } catch (error) {
        return {
            floor: null,
            findings: [`engines.node "${declared}" is not readable (${error.message})`]
        };
    }
    const lowest = declaredIntervals[0]?.lo ?? null;
    if (lowest === null) {
        return {
            floor: null,
            findings: [`engines.node "${declared}" has no lower bound, so it declares no floor`]
        };
    }

    const { floor, findings } = requiredFloor(lock, lowest[0]);
    if (floor === null) return { floor, findings };

    const { ranges } = lockedRanges(lock, lowest[0]);
    const fix = `Write ">=${show(floor)}" in engines.node and "${show(floor)}" in .nvmrc.`;

    const belowDeclared = rejecting(ranges, lowest);
    if (belowDeclared.length > 0) {
        findings.push(
            `engines.node "${declared}" admits ${show(lowest)}, which ${String(belowDeclared.length)} locked package(s) reject: ${describeRejecting(belowDeclared, lowest[0])}. The floor is ${show(floor)}. ${fix}`
        );
    }

    if (typeof nvmrc === 'string') {
        const text = nvmrc.trim();
        const resolved = nvmrcVersion(text);
        if (resolved === null) {
            findings.push(
                `.nvmrc "${text}" is not a Node version, so the floor cannot be read from it. ${fix}`
            );
        } else {
            const belowNvmrc = rejecting(ranges, resolved);
            if (belowNvmrc.length > 0) {
                findings.push(
                    `.nvmrc "${text}" resolves below what ${String(belowNvmrc.length)} locked package(s) need: ${describeRejecting(belowNvmrc, lowest[0])}. The floor is ${show(floor)}. ${fix}`
                );
            }
        }
    }
    return { floor, findings };
};

const readText = (file) => {
    try {
        return readFileSync(file, 'utf8');
    } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
};

export const run = ({ root }) => {
    let manifest;
    let lock;
    try {
        manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
        lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    } catch (error) {
        return {
            floor: null,
            findings: [`package.json or package-lock.json cannot be read: ${error.message}`]
        };
    }
    return checkEnginesFloor({ manifest, lock, nvmrc: readText(path.join(root, '.nvmrc')) });
};

const main = () => {
    const argv = process.argv.slice(2);
    const rootFlag = argv.indexOf('--root');
    const root = rootFlag === -1 ? process.cwd() : path.resolve(argv[rootFlag + 1]);
    const { floor, findings } = run({ root });

    console.log('engines-floor');
    for (const finding of findings) console.log(`  ✖ ${finding}`);
    if (findings.length === 0) {
        console.log(
            `  ✔ Node floor ${show(floor)}: engines.node and .nvmrc are not below what package-lock.json needs`
        );
        process.exit(0);
    }
    console.log(
        `\n✖ engines-floor: ${String(findings.length)} finding(s). Raise the declaration to the floor — never lower the check.`
    );
    process.exit(1);
};

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
