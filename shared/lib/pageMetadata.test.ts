import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';

import { buildPageMetadata } from './pageMetadata';

/*
 * `next-intl/server` reads the request context Next.js builds per render; vitest has none. The subject
 * is the metadata contract, so the translator is replaced with the same messages the app uses.
 */
vi.mock('next-intl/server', () => ({
    getTranslations: ({ namespace }: { namespace: string }) =>
        Promise.resolve((key: string): string => {
            const [, name] = namespace.split('.');
            const section = messages.meta[name as keyof typeof messages.meta] as Record<
                string,
                string
            >;
            return section[key] ?? key;
        })
}));

describe('buildPageMetadata', () => {
    it('takes the title and description from the page section of the messages', async () => {
        const metadata = await buildPageMetadata({
            locale: 'en',
            page: 'exampleForm',
            path: '/example-form'
        });

        expect(metadata.title).toBe(messages.meta.exampleForm.title);
        expect(metadata.description).toBe(messages.meta.exampleForm.description);
    });

    it('points the canonical and one alternate per routing locale at the page path', async () => {
        const metadata = await buildPageMetadata({
            locale: 'en',
            page: 'exampleForm',
            path: '/example-form'
        });

        expect(metadata.alternates?.canonical).toBe('/en/example-form');
        expect(metadata.alternates?.languages).toEqual({ en: '/en/example-form' });
    });

    it('treats an empty path as the locale root', async () => {
        const metadata = await buildPageMetadata({ locale: 'en', page: 'home', path: '' });

        expect(metadata.alternates?.canonical).toBe('/en');
        expect(metadata.openGraph).toMatchObject({ url: '/en' });
    });

    /*
     * Next merges metadata one key deep: a page that exports `openGraph` replaces the locale layout's
     * whole object, so a page that does not export it shows the layout's preview, the same on every
     * route. These pin that each page states its own, and carries what the layout would have given.
     */
    it('gives the page its own Open Graph preview, not the site-wide one', async () => {
        const metadata = await buildPageMetadata({
            locale: 'en',
            page: 'exampleForm',
            path: '/example-form'
        });

        expect(metadata.openGraph).toMatchObject({
            type: 'website',
            locale: 'en',
            siteName: messages.meta.root.siteName,
            title: messages.meta.exampleForm.title,
            description: messages.meta.exampleForm.description,
            url: '/en/example-form'
        });
        expect(metadata.openGraph).not.toMatchObject({ title: messages.meta.root.titleDefault });
    });

    it('gives the page its own Twitter card text', async () => {
        const metadata = await buildPageMetadata({ locale: 'en', page: 'home', path: '' });

        expect(metadata.twitter).toMatchObject({
            card: 'summary_large_image',
            title: messages.meta.home.title,
            description: messages.meta.home.description
        });
    });

    it('differs between two pages', async () => {
        const home = await buildPageMetadata({ locale: 'en', page: 'home', path: '' });
        const form = await buildPageMetadata({
            locale: 'en',
            page: 'exampleForm',
            path: '/example-form'
        });

        expect(home.openGraph).not.toEqual(form.openGraph);
        expect(home.twitter).not.toEqual(form.twitter);
    });
});

describe('pages that state their own social preview', () => {
    // Next attaches an `opengraph-image` file to the segment that holds it, and a page's `openGraph`
    // replaces the layout's whole object, image included. A page built with `buildPageMetadata` that
    // has no image file beside it therefore shares a preview with a title and no picture.
    const appDir = path.resolve(process.cwd(), 'app');
    const pages = readdirSync(appDir, { recursive: true, encoding: 'utf8' })
        .filter((file) => path.basename(file) === 'page.tsx')
        .filter((file) =>
            readFileSync(path.join(appDir, file), 'utf8').includes('buildPageMetadata(')
        );

    it('finds the pages that use the helper', () => {
        expect(pages.length).toBeGreaterThan(0);
    });

    it.each(pages)('has an opengraph-image beside %s', (page) => {
        const folder = path.join(appDir, path.dirname(page));

        expect(existsSync(path.join(folder, 'opengraph-image.tsx'))).toBe(true);
    });
});
