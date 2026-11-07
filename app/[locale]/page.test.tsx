import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';
import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import HomePage, { generateMetadata } from './page';

/*
 * `next-intl/server` reads the request context Next.js builds per render; jsdom has none. The
 * subject is the page contract (metadata from the messages, the start page as the body), so the
 * server helpers are replaced with the same messages the provider uses. The page pins no request
 * locale of its own, so the stand-in offers no `setRequestLocale`: a call to it fails the test.
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

const params = Promise.resolve({ locale: 'en' });
const unknownLocale = Promise.resolve({ locale: 'xx' });

describe('home page entry', () => {
    it('emits the localized description and one alternate per routing locale', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.description).toBe(messages.meta.home.description);
        expect(metadata.alternates?.canonical).toBe('/en');
        expect(metadata.alternates?.languages).toEqual({ en: '/en' });
    });

    // The locale layout owns `title.template`, and Next never applies a template to the page of the
    // segment that defines it. The home page is that page, so it states the whole title.
    it('states the whole document title, brand suffix included', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.title).toEqual({ absolute: 'Home | React Enterprise Foundation' });
    });

    it('states its own social preview instead of inheriting the site-wide one', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.openGraph).toMatchObject({
            title: messages.meta.home.title,
            description: messages.meta.home.description,
            url: '/en'
        });
        expect(metadata.twitter).toMatchObject({ title: messages.meta.home.title });
    });

    it('renders the start page as the body', async () => {
        renderWithProviders(await HomePage({ params }));

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(messages.home.title);
    });

    it('answers 404 for a locale the routing does not serve', async () => {
        const notFound = { digest: expect.stringContaining('404') as unknown };

        await expect(generateMetadata({ params: unknownLocale })).rejects.toMatchObject(notFound);
        await expect(HomePage({ params: unknownLocale })).rejects.toMatchObject(notFound);
    });
});
