import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';
import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import HomePage, { generateMetadata } from './page';

/*
 * `next-intl/server` reads the request context Next.js builds per render; jsdom has none. The
 * subject is the page contract (metadata from the messages, the start page as the body), so the
 * server helpers are replaced with the same messages the provider uses.
 */
vi.mock('next-intl/server', () => ({
    setRequestLocale: (): void => {},
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

describe('home page entry', () => {
    it('emits the localized title, description and one alternate per routing locale', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.title).toBe(messages.meta.home.title);
        expect(metadata.description).toBe(messages.meta.home.description);
        expect(metadata.alternates?.canonical).toBe('/en');
        expect(metadata.alternates?.languages).toEqual({ en: '/en' });
    });

    it('renders the start page as the body', async () => {
        renderWithProviders(await HomePage({ params }));

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(messages.home.title);
    });
});
