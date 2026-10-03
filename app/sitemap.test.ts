import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROUTES } from './sitemap';

const LOCALE_DIR = path.join(import.meta.dirname, '[locale]');

/** `[id]`-style folders are dynamic segments — a sitemap can't enumerate them statically, so
 * they're excluded here the same way the brief excludes them from the check. */
const isDynamicSegment = (name: string): boolean => name.startsWith('[') && name.endsWith(']');

/** Every `page.tsx` under `dir`, as the route path it serves (relative to `app/[locale]`,
 * `''` for the index route), skipping dynamic segments. */
const findPageRoutes = (dir: string, routePrefix: string): string[] => {
    const routes: string[] = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (isDynamicSegment(entry.name)) continue;
            routes.push(
                ...findPageRoutes(path.join(dir, entry.name), `${routePrefix}/${entry.name}`)
            );
        } else if (entry.name === 'page.tsx') {
            routes.push(routePrefix);
        }
    }

    return routes;
};

describe('sitemap ROUTES', () => {
    it('lists every static app/[locale]/**/page.tsx route', () => {
        // Adding a page here without a matching sitemap.ts entry must turn this red.
        const discoveredRoutes = findPageRoutes(LOCALE_DIR, '').sort();
        const declaredRoutes = ROUTES.map(({ path: routePath }) => routePath).sort();

        expect(discoveredRoutes).toEqual(declaredRoutes);
    });
});
