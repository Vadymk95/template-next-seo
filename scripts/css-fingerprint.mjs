/**
 * css-fingerprint - a short hash of the stylesheets the Tailwind lint rules read.
 *
 * `tailwindcss/*` and `better-tailwindcss/*` open the stylesheet themselves (tokens, utilities and
 * variants decide what is a known class, its order and its canonical form). ESLint's cache keys on
 * the linted file and the resolved config, never on a file a rule reads on its own, so after a token
 * or utility change a cached run replays the verdicts of the old stylesheet: a false green. The
 * config carries this fingerprint in `settings`, which ESLint hashes into every cache entry of the
 * files the rules cover, so editing the stylesheet re-lints those files and nothing else.
 *
 * The inputs are the entry stylesheet and the local stylesheets it reaches through `@import`.
 * Packages (`@import 'tailwindcss'`) are left out: their files sit in node_modules and move with the
 * lockfile, which is not what this key is for.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const FINGERPRINT_LENGTH = 16;
// `@import "./a.css"`, `@import './a.css' layer(base)`, `@import url("./a.css")`, `@import url(./a.css) screen`.
const IMPORT = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1/g;

const isFile = (file) => existsSync(file) && statSync(file).isFile();

/** The local stylesheets one file imports, as absolute paths, in the order it imports them. */
const importsOf = (file) => {
    const directory = path.dirname(file);

    return [...readFileSync(file, 'utf8').matchAll(IMPORT)]
        .map((match) => path.resolve(directory, match[2]))
        .filter(isFile);
};

/** The entry stylesheet and every local stylesheet it imports, entry first, each once, as absolute paths. */
export const cssInputs = ({ root, entry }) => {
    const first = path.resolve(root, entry);
    if (!isFile(first)) {
        throw new Error(
            `css-fingerprint: the Tailwind entry stylesheet ${entry} does not exist under ${root}; point TAILWIND_ENTRY in eslint.config.js at it`
        );
    }

    const seen = new Set();
    const visit = (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        for (const imported of importsOf(file)) visit(imported);
    };
    visit(first);

    return [...seen];
};

/** A hash of the names and contents of `cssInputs`, relative to the entry's folder so a moved checkout keeps it. */
export const cssFingerprint = ({ root, entry }) => {
    const base = path.dirname(path.resolve(root, entry));
    const hash = createHash('sha256');
    for (const file of cssInputs({ root, entry })) {
        hash.update(path.relative(base, file)).update('\0').update(readFileSync(file)).update('\0');
    }

    return hash.digest('hex').slice(0, FINGERPRINT_LENGTH);
};
