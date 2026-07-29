// The EXEMPT list is the part of this gate people actually edit, and every edit
// widens it — usually to get one commit moving. These cases pin what the exemptions
// are FOR, so a widening that changes the policy fails here instead of silently
// letting untested logic land.
//
// This repo has no `src/`: logic lives in the top-level App Router layers, so the
// layer predicate itself is worth pinning too — a stray layer name added to it would
// silently pull unrelated files into the gate, and a missing one would drop a whole
// layer out of it.
import { describe, expect, it } from 'vitest';

import { findMissingSiblings, isSrcLogic } from './check-test-siblings.mjs';

const nothingExists = () => false;

describe('isSrcLogic', () => {
    it.each([
        'shared/lib/logger.ts',
        'shared/lib/rateLimitCore.ts',
        'features/example-form/model/schema.ts',
        'features/example-form/ui/ExampleForm.tsx',
        'app/actions/example-form.ts',
        'app/api/health/route.ts',
        'i18n/request-locale.ts'
    ])('treats %s as logic that needs a test', (file) => {
        expect(isSrcLogic(file)).toBe(true);
    });

    it.each([
        ['a test file', 'shared/lib/logger.test.ts'],
        ['a type declaration', 'global.d.ts'],
        ['a barrel', 'features/example-form/index.ts'],
        ['a constants table', 'shared/constants/constants.ts'],
        ['a types-only module', 'features/example-form/model/types.ts'],
        ['a template seed', 'shared/lib/api/_exampleQuery.ts'],
        // App Router conventional files: framework-shaped shells, not logic.
        ['a layout', 'app/[locale]/layout.tsx'],
        ['a loading state', 'app/[locale]/loading.tsx'],
        ['an error boundary', 'app/[locale]/error.tsx'],
        ['the root error boundary', 'app/global-error.tsx'],
        ['a not-found', 'app/[locale]/not-found.tsx'],
        ['a template', 'app/[locale]/template.tsx'],
        ['the sitemap', 'app/sitemap.ts'],
        ['robots', 'app/robots.ts'],
        ['an opengraph image', 'app/[locale]/opengraph-image.tsx'],
        // Presentational primitives directly under shared/ui.
        ['a shared/ui primitive', 'shared/ui/Button.tsx'],
        ['a test util', 'shared/lib/test-utils/render.tsx'],
        // The dev playground is gated out of production by `proxy.ts`.
        ['a dev playground route', 'app/dev/ui/page.tsx']
    ])('exempts %s', (_label, file) => {
        expect(isSrcLogic(file)).toBe(false);
    });

    it('only recognises the declared layers', () => {
        // Anything outside app / features / entities / shared / i18n is not this
        // gate's business — scripts, e2e specs and root config all live elsewhere.
        // These paths are `.ts` on purpose: an `.mjs` path is rejected by the
        // extension half of the predicate, so it could not catch a stray layer
        // name being added to the layer half.
        expect(isSrcLogic('scripts/seed.ts')).toBe(false);
        expect(isSrcLogic('e2e/fixtures/user.ts')).toBe(false);
        expect(isSrcLogic('tooling/codegen/run.ts')).toBe(false);
        expect(isSrcLogic('e2e/home.spec.ts')).toBe(false);
        expect(isSrcLogic('next.config.ts')).toBe(false);
        expect(isSrcLogic('proxy.ts')).toBe(false);
        expect(isSrcLogic('messages/en.json')).toBe(false);
    });

    it('requires a path INSIDE a layer, not the layer name alone', () => {
        expect(isSrcLogic('shared.ts')).toBe(false);
        expect(isSrcLogic('appointments/booking.ts')).toBe(false);
    });

    it('does not exempt a nested directory that reuses an exempt name', () => {
        // `^shared/ui/[^/]+\.tsx$` is deliberately one level deep: a component
        // nested further owns real composition and needs a test. `^app/dev/` is
        // anchored, so a feature's own `dev/` directory is ordinary code.
        expect(isSrcLogic('shared/ui/table/TableRow.tsx')).toBe(true);
        expect(isSrcLogic('features/editor/app/dev/Panel.tsx')).toBe(true);
    });

    it('does not exempt a filename that merely starts with an exempt name', () => {
        expect(isSrcLogic('shared/lib/constantsFactory.ts')).toBe(true);
        expect(isSrcLogic('features/example-form/model/typesGuard.ts')).toBe(true);
    });
});

describe('findMissingSiblings', () => {
    it('reports a logic file with no sibling', () => {
        expect(findMissingSiblings(['shared/lib/logger.ts'], nothingExists)).toEqual([
            'shared/lib/logger.ts'
        ]);
    });

    it('accepts either sibling extension', () => {
        expect(
            findMissingSiblings(['shared/lib/logger.ts'], (p) => p === 'shared/lib/logger.test.ts')
        ).toEqual([]);
        expect(
            findMissingSiblings(['features/example-form/ui/ExampleForm.tsx'], (p) =>
                p.endsWith('ExampleForm.test.tsx')
            )
        ).toEqual([]);
    });

    it('passes an empty change set', () => {
        expect(findMissingSiblings([], nothingExists)).toEqual([]);
    });

    it('never reports an exempt file, even with nothing on disk', () => {
        expect(findMissingSiblings(['app/[locale]/layout.tsx'], nothingExists)).toEqual([]);
    });

    it('reports every offender rather than stopping at the first', () => {
        expect(
            findMissingSiblings(
                ['shared/lib/a.ts', 'app/robots.ts', 'shared/lib/b.ts'],
                nothingExists
            )
        ).toEqual(['shared/lib/a.ts', 'shared/lib/b.ts']);
    });

    it('probes only paths derived from the file under test', () => {
        const probed = [];
        findMissingSiblings(['shared/lib/rateLimitCore.ts'], (path) => {
            probed.push(path);
            return false;
        });

        expect(probed).toEqual([
            'shared/lib/rateLimitCore.test.ts',
            'shared/lib/rateLimitCore.test.tsx'
        ]);
    });

    it('is not satisfied by a sibling belonging to a different module', () => {
        expect(findMissingSiblings(['shared/lib/a.ts'], (p) => p.includes('b.test'))).toEqual([
            'shared/lib/a.ts'
        ]);
    });
});
