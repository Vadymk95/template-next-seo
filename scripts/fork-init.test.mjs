import { execFileSync } from 'node:child_process';
import {
    appendFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Resolved from the repo root, not from `import.meta.url`: vitest serves this module over its own
// transform URL, so the file-URL form would not locate the script on disk.
const ROOT = process.cwd();
const SCRIPT_PATH = 'scripts/fork-init.mjs';
const TEST_PATH = 'scripts/fork-init.test.mjs';
const OWNER_DECISIONS = [
    'Site copy and metadata',
    'Social preview card',
    'Production origin',
    'Rate-limit key prefix',
    'Languages',
    'Palette and rule assumptions',
    'Licence',
    'Template scaffolding',
    'Repository layout',
    'Version holds'
];

/* The script rewrites the repository it runs in, so NO case runs it here: every case works on a
   throwaway copy in the system temp folder, and `run` refuses any other working directory. GIT_* is
   stripped so a child `git` never answers for the real repository when this runs inside a hook. */
const CLEAN_ENV = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    CI: ''
};
const CAPTURE = ['ignore', 'pipe', 'pipe'];
const TEMP_ROOT = realpathSync(tmpdir());
const IDENTITY = [
    '-c',
    'user.name=fork-init-test',
    '-c',
    'user.email=fork-init-test@example.invalid'
];

const NEW_NAME = 'acme-portal';
const NEW_TITLE = 'Acme Portal';
const NEW_HOLDER = 'Acme Ltd';

const git = (cwd, ...args) =>
    execFileSync('git', [...IDENTITY, ...args], {
        cwd,
        encoding: 'utf8',
        env: CLEAN_ENV,
        stdio: CAPTURE
    });

const run = (cwd, args) => {
    if (!realpathSync(cwd).startsWith(`${TEMP_ROOT}${sep}`)) {
        throw new Error(`fork:init must only run on a throwaway copy, not in ${cwd}`);
    }
    try {
        const output = execFileSync(process.execPath, [SCRIPT_PATH, ...args], {
            cwd,
            encoding: 'utf8',
            env: CLEAN_ENV,
            stdio: CAPTURE
        });
        return { code: 0, output };
    } catch (error) {
        return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
};

const run2 = (cwd, args) => {
    try {
        const output = execFileSync(process.execPath, args, {
            cwd,
            encoding: 'utf8',
            env: CLEAN_ENV,
            stdio: CAPTURE
        });
        return { code: 0, output };
    } catch (error) {
        return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
};

const docsCheck = (cwd) => run2(cwd, ['scripts/docs-check.mjs']);

const read = (dir, file) => readFileSync(join(dir, file), 'utf8');
const readJson = (dir, file) => JSON.parse(read(dir, file));
const status = (dir) => git(dir, 'status', '--porcelain', '--untracked-files=all');
const commitAll = (dir, message) => {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', message);
};

/** Every file the working tree holds that git lists (tracked, or new and not ignored). */
const listFiles = (dir) =>
    git(dir, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')
        .split('\0')
        .filter((file) => file !== '' && existsSync(join(dir, file)));

/** What a fork must hold after a successful run: no part of the command, every owner decision. */
const expectCommandGone = (dir) => {
    expect(existsSync(join(dir, SCRIPT_PATH))).toBe(false);
    expect(existsSync(join(dir, TEST_PATH))).toBe(false);
    expect(readJson(dir, 'package.json').scripts).not.toHaveProperty('fork:init');
    const traces = listFiles(dir).filter((file) => {
        const text = readFileSync(join(dir, file), 'utf8');
        return text.includes('fork:init') || text.includes('fork-init');
    });
    expect(traces).toEqual([]);
    const readme = read(dir, 'README.md');
    for (const decision of OWNER_DECISIONS) expect(readme, decision).toContain(`**${decision}**`);
    expect(readme).toContain('.template-origin.json');
};

// The history files keep the template's words on purpose, and so does the origin record.
const HISTORY_FILES = new Set([
    '.cursor/brain/DECISIONS.md',
    'CHANGELOG.md',
    '.template-origin.json'
]);

/* What may still name the template after a run, and why: the build placeholder origin (a package
   name is not a host name, so the command cannot derive it: a person sets the real origin), the
   rate-limit key prefix (its file has no test beside it, so staging a rewrite would fail the
   commit hook), the links that point at the template's own commits as evidence, and the line of the shared agent
   block that lists the sibling templates. */
const KEPT_TEMPLATE_WORDS = [
    /template-next-seo\.invalid/g,
    /template-next-seo:ratelimit/g,
    /Vadymk95\/template-next-seo/g,
    /\(template-1, template-spa-pwa, template-next-seo, template-rn\)/g
];
const withoutKeptWords = (text) =>
    KEPT_TEMPLATE_WORDS.reduce((rest, pattern) => rest.replace(pattern, ''), text);

let base = null;
let origin = null;
const copies = [];

const makeCopy = () => {
    const dir = mkdtempSync(join(tmpdir(), 'fork-init-'));
    copies.push(dir);
    cpSync(base, dir, { recursive: true });
    return dir;
};

beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), 'fork-init-base-'));
    copies.push(base);
    for (const file of listFiles(ROOT)) {
        mkdirSync(dirname(join(base, file)), { recursive: true });
        cpSync(join(ROOT, file), join(base, file));
    }
    git(base, 'init', '-q', '-b', 'master');
    commitAll(base, 'chore: the template as a fork receives it');

    const pkg = readJson(base, 'package.json');
    origin = {
        name: pkg.name,
        version: pkg.version,
        title: readJson(base, 'messages/en.json').meta.root.titleDefault,
        readmeTitle: /^# (.+)$/m.exec(read(base, 'README.md'))[1],
        holder: /^Copyright \(c\) \d{4} (.+)$/m.exec(read(base, 'LICENSE'))[1],
        commit: git(base, 'rev-parse', 'HEAD').trim()
    };
}, 60_000);

afterAll(() => {
    for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

describe('fork-init, one full run', () => {
    let dir = null;
    let result = null;
    let changed = null;

    beforeAll(() => {
        dir = makeCopy();
        result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE, '--holder', NEW_HOLDER]);
        changed = status(dir)
            .split('\n')
            .filter(Boolean)
            .map((line) => line.slice(3));
    }, 120_000);

    it('exits 0 and leaves docs:check green', () => {
        expect(result.output).toContain('docs:check');
        expect(result.code, result.output).toBe(0);
        const check = docsCheck(dir);
        expect(check.code, check.output).toBe(0);
    });

    it('removes the command from the fork and keeps the owner decisions in the README', () => {
        expectCommandGone(dir);
    });

    it('leaves the template name, titles and holder in no file but the history files', () => {
        const leaks = [];
        for (const file of listFiles(dir)) {
            if (HISTORY_FILES.has(file)) continue;
            const content = withoutKeptWords(readFileSync(join(dir, file), 'utf8'));
            for (const old of [origin.name, origin.title, origin.readmeTitle, origin.holder]) {
                if (content.includes(old)) leaks.push(`${file}: ${old}`);
            }
        }
        expect(leaks).toEqual([]);
    });

    it('gives the manifest, the lockfile root and the release manifest one name and one version', () => {
        const pkg = readJson(dir, 'package.json');
        const lock = readJson(dir, 'package-lock.json');
        const release = readJson(dir, '.release-please-manifest.json');

        expect([pkg.name, lock.name, lock.packages[''].name]).toEqual([
            NEW_NAME,
            NEW_NAME,
            NEW_NAME
        ]);
        expect([pkg.version, lock.version, lock.packages[''].version]).toEqual([
            '0.1.0',
            '0.1.0',
            '0.1.0'
        ]);
        expect(release).toEqual({ '.': '0.1.0' });
    });

    it('carries the new title into the messages, the footer, the tests, the README and the banner', () => {
        const messages = readJson(dir, 'messages/en.json');
        expect(messages.meta.root).toMatchObject({
            titleDefault: NEW_TITLE,
            titleTemplate: `%s | ${NEW_TITLE}`,
            siteName: NEW_TITLE
        });
        expect(messages.meta.home.description).toBe(`Welcome to ${NEW_TITLE}`);
        expect(read(dir, 'shared/ui/common/Footer/index.tsx')).toContain(
            `© {CURRENT_YEAR} ${NEW_TITLE}. All rights reserved.`
        );
        expect(read(dir, 'app/[locale]/page.test.tsx')).toContain(`'Home | ${NEW_TITLE}'`);
        expect(read(dir, 'e2e/smoke.spec.ts')).toContain(`toHaveTitle(/Home \\| ${NEW_TITLE}/)`);
        expect(read(dir, 'README.md').split('\n')[0]).toBe(`# ${NEW_TITLE}`);
        expect(read(dir, 'scripts/startup.js')).toContain(NEW_TITLE);
        expect(read(dir, 'LICENSE')).toContain(` ${NEW_HOLDER}\n`);
    });

    it('carries the new name into the title lines and leaves the rate-limit key prefix alone', () => {
        const titleLines = {
            'AGENTS.md': `# ${NEW_NAME} — agent guide`,
            '.cursor/brain/PROJECT_CONTEXT.md': `# ${NEW_NAME} — Project Context`,
            '.cursor/brain/MAP.md': `# MAP — ${NEW_NAME}`,
            '.cursor/brain/SKELETONS.md': `# SKELETONS — danger zones (${NEW_NAME})`,
            '.cursor/rules/global.mdc': `# Global Standards — ${NEW_NAME}`,
            'SECURITY_REQUIREMENTS.md': `# Security Requirements — ${NEW_NAME}`
        };
        for (const [file, line] of Object.entries(titleLines)) {
            expect(read(dir, file).split('\n'), file).toContain(line);
        }
        expect(read(dir, 'shared/lib/upstashRateLimit.ts')).toBe(
            read(base, 'shared/lib/upstashRateLimit.ts')
        );
    });

    it('restarts the changelog and points the release bootstrap at the fork’s own commit', () => {
        expect(read(dir, 'CHANGELOG.md')).toBe('# Changelog\n');
        const before = readJson(base, 'release-please-config.json');
        const after = readJson(dir, 'release-please-config.json');
        expect(after['bootstrap-sha']).toBe(origin.commit);
        expect({ ...after, 'bootstrap-sha': null }).toEqual({ ...before, 'bootstrap-sha': null });
    });

    it('records the template, its version and its commit', () => {
        expect(readJson(dir, '.template-origin.json')).toEqual({
            template: origin.name,
            version: origin.version,
            commit: origin.commit
        });
    });

    it('starts the decision history empty, with a pointer at the template’s version', () => {
        const decisions = read(dir, '.cursor/brain/DECISIONS.md');
        expect(decisions.split('\n')[0]).toBe(`# DECISIONS — ${NEW_NAME}`);
        expect(decisions).not.toMatch(/^## /m);
        expect(decisions).toContain(`version ${origin.version}`);
        expect(decisions).toContain('.template-origin.json');
        const rows = decisions.split('\n').filter((line) => line.startsWith('|'));
        expect(rows).toHaveLength(2);
    });

    it('leaves no pointer into the removed entries, a line break between the parts included', () => {
        const pointers = [];
        for (const file of listFiles(dir)) {
            if (HISTORY_FILES.has(file) || !/\.mdc?$/.test(file)) continue;
            const text = read(dir, file);
            if (/DECISIONS\.md`?\s*(?:§|")/.test(text)) pointers.push(file);
        }
        expect(pointers).toEqual([]);
    });

    it('names the entries a rewritten pointer used to cite, chained pointers included', () => {
        const agents = read(dir, 'AGENTS.md');
        expect(agents).toContain('the template\'s decisions "Content variance" and "Cross-engine');
        expect(read(dir, '.cursor/brain/PROJECT_CONTEXT.md')).toContain(
            'the template\'s decision "Build and styling basics" (`.template-origin.json`)'
        );
        expect(read(dir, '.cursor/brain/READING_INDEX.md')).toContain(
            'the template\'s decision "Advisory exceptions are data" (`.template-origin.json`)'
        );
    });

    it('leaves a space between a rewritten pointer and the words that follow it', () => {
        const glued = [];
        for (const file of listFiles(dir)) {
            if (!/\.mdc?$/.test(file)) continue;
            if (read(dir, file).includes('.template-origin.json`)(')) glued.push(file);
        }
        expect(glued).toEqual([]);
    });

    it('keeps both CodeQL pieces without --private', () => {
        expect(read(dir, '.github/workflows/security.yml')).toMatch(/^ {4}codeql:$/m);
        expect(read(dir, '.github/ruleset.json')).toContain('CodeQL');
    });

    it('touches only the files it names', () => {
        const allowed = new Set([
            '.cursor/brain/DECISIONS.md',
            '.cursor/brain/MAP.md',
            '.cursor/brain/PROJECT_CONTEXT.md',
            '.cursor/brain/SKELETONS.md',
            '.cursor/rules/global.mdc',
            '.release-please-manifest.json',
            '.template-origin.json',
            'AGENTS.md',
            'CHANGELOG.md',
            'LICENSE',
            'README.md',
            'SECURITY_REQUIREMENTS.md',
            'app/[locale]/page.test.tsx',
            'e2e/smoke.spec.ts',
            'messages/en.json',
            'package-lock.json',
            'package.json',
            'release-please-config.json',
            'scripts/startup.js',
            'shared/ui/common/Footer/index.tsx',
            SCRIPT_PATH,
            TEST_PATH
        ]);
        const rewrittenPointers = [
            '.cursor/brain/EXTENSIONS.md',
            '.cursor/brain/READING_INDEX.md',
            '.cursor/brain/VERIFICATION.md',
            '.cursor/rules/agent-pipeline.mdc',
            '.cursor/rules/constants.mdc',
            '.cursor/rules/resilience.mdc'
        ];
        const outside = changed.filter(
            (file) => !allowed.has(file) && !rewrittenPointers.includes(file)
        );
        expect(outside).toEqual([]);
        expect(changed.filter((file) => rewrittenPointers.includes(file))).toEqual(
            rewrittenPointers
        );
    });

    it('prints what is left: the GitHub commands in order, the human choices and the scaffolding', () => {
        const out = result.output;
        const at = (text) => {
            const index = out.indexOf(text);
            expect(index, `missing in the output: ${text}`).toBeGreaterThan(-1);
            return index;
        };
        const permission = at('actions/permissions/workflow');
        const label = at('gate-change');
        const ruleset = at(
            'gh api --method POST repos/OWNER/REPO/rulesets --input .github/ruleset.json'
        );
        expect(ruleset).toBeGreaterThan(permission);
        expect(ruleset).toBeGreaterThan(label);
        at('rules/branches/');
        at('RELEASE_PLEASE_TOKEN');
        at('NEXT_PUBLIC_APP_URL');
        at('.env.example');
        at('.husky/pre-push');
        at('app/[locale]/layout.tsx');
        at('opengraph-image.tsx');
        at('messages/en.json');
        at('.cursor/brain/SKELETONS.md');
        expect(out).not.toMatch(/removed? the (seeds|scaffolding)/i);
    });
});

describe('fork-init, a title with characters the files treat as syntax', () => {
    const AWKWARD = 'Acme\'s "Portal" & {Co} $x `y` \\ / |';
    let dir = null;
    let result = null;

    beforeAll(() => {
        dir = makeCopy();
        result = run(dir, ['--name', '@acme/portal', '--title', AWKWARD]);
    }, 120_000);

    it('keeps the JSON, the banner script and the docs valid, and docs:check green', () => {
        expect(result.code, result.output).toBe(0);
        expect(readJson(dir, 'messages/en.json').meta.root.titleDefault).toBe(AWKWARD);
        expect(readJson(dir, 'package.json').name).toBe('@acme/portal');
        const banner = run2(dir, ['--check', 'scripts/startup.js']);
        expect(banner.code, banner.output).toBe(0);
        const footer = read(dir, 'shared/ui/common/Footer/index.tsx');
        expect(footer).toContain('&#123;Co&#125;');
        expect(footer).not.toMatch(/\{Co\}/);
        const check = docsCheck(dir);
        expect(check.code, check.output).toBe(0);
    });
});

describe('fork-init, refusals', () => {
    const REFUSALS = [
        ['an invalid package name', ['--name', 'Bad Name', '--title', NEW_TITLE], /package name/i],
        ['an upper-case package name', ['--name', 'Acme', '--title', NEW_TITLE], /package name/i],
        ['a leading dot in the name', ['--name', '.acme', '--title', NEW_TITLE], /package name/i],
        ['a missing name', ['--title', NEW_TITLE], /--name/],
        ['a missing value', ['--title', NEW_TITLE, '--name'], /--name/],
        ['the template’s own name', null, /differ from the template/i],
        ['an empty title', ['--name', NEW_NAME, '--title', ''], /--title/],
        ['a blank title', ['--name', NEW_NAME, '--title', '   '], /--title/],
        ['a missing title', ['--name', NEW_NAME], /--title/],
        ['an empty holder', ['--name', NEW_NAME, '--title', NEW_TITLE, '--holder', ''], /--holder/],
        [
            'an unknown option',
            ['--name', NEW_NAME, '--title', NEW_TITLE, '--bogus'],
            /unknown option/i
        ]
    ];

    it.each(REFUSALS)(
        'refuses %s and changes nothing',
        (_label, args, message) => {
            const dir = makeCopy();
            const before = git(dir, 'rev-parse', 'HEAD');
            const result = run(dir, args ?? ['--name', origin.name, '--title', NEW_TITLE]);

            expect(result.code).toBe(1);
            expect(result.output).toMatch(message);
            expect(status(dir)).toBe('');
            expect(git(dir, 'rev-parse', 'HEAD')).toBe(before);
        },
        30_000
    );

    it('refuses a dirty working tree and changes nothing more', () => {
        const dir = makeCopy();
        for (const dirt of [
            () => cpSync(join(dir, 'LICENSE'), join(dir, 'untracked.txt')),
            () => rmSync(join(dir, 'LICENSE'))
        ]) {
            dirt();
            const before = status(dir);
            const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

            expect(result.code).toBe(1);
            expect(result.output).toMatch(/not clean/i);
            expect(status(dir)).toBe(before);
        }
    }, 30_000);

    it('refuses a second run with the script copied back, before and after the first is committed', () => {
        const dir = makeCopy();
        expect(run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]).code).toBe(0);
        cpSync(join(ROOT, SCRIPT_PATH), join(dir, SCRIPT_PATH));

        const dirty = status(dir);
        const again = run(dir, ['--name', 'other-app', '--title', 'Other App']);
        expect(again.code).toBe(1);
        expect(again.output).toMatch(/already ran/i);
        expect(status(dir)).toBe(dirty);

        commitAll(dir, 'chore: start from the template');
        const committed = run(dir, ['--name', 'other-app', '--title', 'Other App']);
        expect(committed.code).toBe(1);
        expect(committed.output).toMatch(/already ran/i);
        expect(status(dir)).toBe('');
    }, 120_000);

    it('refuses a tree that already holds the origin record and changes nothing', () => {
        const dir = makeCopy();
        writeFileSync(join(dir, '.template-origin.json'), '{}\n');
        commitAll(dir, 'chore: an initialised fork');
        const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

        expect(result.code).toBe(1);
        expect(result.output).toMatch(/already ran/i);
        expect(status(dir)).toBe('');
        expect(readJson(dir, 'package.json').name).toBe(origin.name);
    }, 30_000);

    it('exits 1 on a red docs:check and leaves the command whole, edits written', () => {
        const dir = makeCopy();
        appendFileSync(join(dir, 'README.md'), '\nSee `scripts/no-such-file.mjs`.\n');
        commitAll(dir, 'chore: seed a finding docs:check reports');
        const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

        expect(result.code).toBe(1);
        expect(result.output).toContain('docs:check: RED');
        expect(result.output).toContain('no-such-file');
        for (const kept of [SCRIPT_PATH, TEST_PATH]) expect(existsSync(join(dir, kept))).toBe(true);
        expect(readJson(dir, 'package.json').scripts).toHaveProperty('fork:init');
        expect(read(dir, 'README.md')).toContain('npm run fork:init');
        expect(readJson(dir, 'package.json').name).toBe(NEW_NAME);
    }, 120_000);

    it('refuses to run outside a git repository', () => {
        const dir = makeCopy();
        rmSync(join(dir, '.git'), { recursive: true, force: true });
        const result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE]);

        expect(result.code).toBe(1);
        expect(result.output).toMatch(/git repository/i);
        expect(readJson(dir, 'package.json').name).toBe(origin.name);
    }, 30_000);
});

describe('fork-init, --dry-run', () => {
    it('lists every planned edit and writes nothing', () => {
        const dir = makeCopy();
        const result = run(dir, [
            '--name',
            NEW_NAME,
            '--title',
            NEW_TITLE,
            '--private',
            '--dry-run'
        ]);

        expect(result.code, result.output).toBe(0);
        expect(status(dir)).toBe('');
        expect(result.output).toMatch(/dry run/i);
        for (const planned of [
            'package.json',
            'package-lock.json',
            'messages/en.json',
            'e2e/smoke.spec.ts',
            '.release-please-manifest.json',
            'release-please-config.json',
            'CHANGELOG.md',
            '.template-origin.json',
            '.cursor/brain/DECISIONS.md',
            '.github/workflows/security.yml',
            '.github/ruleset.json',
            SCRIPT_PATH,
            TEST_PATH,
            'fork:init'
        ]) {
            expect(result.output, planned).toContain(planned);
        }
        for (const kept of [SCRIPT_PATH, TEST_PATH]) expect(existsSync(join(dir, kept))).toBe(true);
        expect(readJson(dir, 'package.json').scripts).toHaveProperty('fork:init');
    }, 30_000);
});

describe('fork-init, --private', () => {
    let dir = null;
    let result = null;

    beforeAll(() => {
        dir = makeCopy();
        git(dir, 'remote', 'add', 'origin', 'https://github.com/acme/widget.git');
        result = run(dir, ['--name', NEW_NAME, '--title', NEW_TITLE, '--private']);
    }, 120_000);

    it('removes the CodeQL job and its required check together, and docs:check stays green', () => {
        expect(result.code, result.output).toBe(0);
        const workflow = read(dir, '.github/workflows/security.yml');
        expect(workflow).not.toMatch(/^ {4}codeql:/m);
        expect(workflow).not.toContain('codeql-action');
        expect(workflow).toMatch(/^ {4}gitleaks:$/m);
        expect(workflow).toMatch(/^ {4}zizmor:$/m);

        const contexts = readJson(dir, '.github/ruleset.json')
            .rules.find((rule) => rule.type === 'required_status_checks')
            .parameters.required_status_checks.map((check) => check.context);
        expect(contexts.some((context) => context.startsWith('CodeQL'))).toBe(false);
        expect(contexts).toContain('Secret scan (gitleaks)');

        const check = docsCheck(dir);
        expect(check.code, check.output).toBe(0);
    });

    it('removes the command from the fork as well', () => {
        expectCommandGone(dir);
    });

    it('reads the owner and repository from the origin remote for the printed commands', () => {
        expect(result.output).toContain('repos/acme/widget/rulesets');
    });
});

describe('fork-init, the script itself', () => {
    it('never calls the network and never runs gh', () => {
        const source = readFileSync(resolve(ROOT, SCRIPT_PATH), 'utf8');

        expect(source).not.toMatch(/\bfetch\s*\(/);
        expect(source).not.toMatch(/node:(https?|net|dns|tls)\b/);
        expect(source).not.toMatch(/execFileSync\(\s*['"]gh['"]/);
        const spawned = [...source.matchAll(/execFileSync\(\s*([^,]+),/g)].map((m) => m[1].trim());
        expect(spawned.length).toBeGreaterThan(0);
        for (const command of spawned) {
            expect(['process.execPath', "'git'"]).toContain(command);
        }
    });
});

describe('fork-init, the list of harness tests a push may leave out', () => {
    // A fork deletes this file. A list that named it would stay green here and turn the guard over
    // the list red in every fork on its first day, so the rule lives in the file that goes.
    it('never names this test file', () => {
        const listed = readJson(ROOT, 'scripts/gate-tiers.json').selfTests?.files ?? [];

        expect(listed).not.toContain(TEST_PATH);
    });
});
