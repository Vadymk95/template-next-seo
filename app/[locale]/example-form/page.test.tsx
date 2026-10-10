import { screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';
import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import ExampleFormPage, { generateMetadata, revalidate } from './page';

/*
 * `next-intl/server` reads the request context Next.js builds per render; jsdom has none. The
 * subject is the page contract (metadata from the messages, the form page as the body), so the
 * server helpers are replaced with the same messages the provider uses.
 */
vi.mock('next-intl/server', () => ({
    setRequestLocale: vi.fn(),
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

// The real action resolves server-side translations; the page only mounts the form around it.
vi.mock('@/app/actions/example-form', () => ({ exampleFormAction: vi.fn() }));

// `@/shared/ui` is a barrel that loads `SmartLink`, whose next-intl navigation is not resolvable in
// jsdom. Same stand-in as `ExampleForm.test.tsx`.
vi.mock('@/shared/ui/common/SmartLink', () => ({
    SmartLink: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>): ReactElement => (
        <a {...props}>{children}</a>
    )
}));

const { setRequestLocale } = await import('next-intl/server');

const params = Promise.resolve({ locale: 'en' });
const unknownLocale = Promise.resolve({ locale: 'xx' });

describe('example form page entry', () => {
    it('revalidates every 30 minutes', () => {
        expect(revalidate).toBe(1800);
    });

    it('emits the localized title, description and one alternate per routing locale', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.title).toBe(messages.meta.exampleForm.title);
        expect(metadata.description).toBe(messages.meta.exampleForm.description);
        expect(metadata.alternates?.canonical).toBe('/en/example-form');
        expect(metadata.alternates?.languages).toEqual({ en: '/en/example-form' });
    });

    it('states its own social preview instead of inheriting the site-wide one', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.openGraph).toMatchObject({
            title: messages.meta.exampleForm.title,
            description: messages.meta.exampleForm.description,
            url: '/en/example-form'
        });
        expect(metadata.twitter).toMatchObject({ title: messages.meta.exampleForm.title });
    });

    it('renders the title, the description and the form as the body', async () => {
        renderWithProviders(await ExampleFormPage({ params }));

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            messages.common.page.exampleForm.title
        );
        expect(screen.getByText(messages.common.page.exampleForm.description)).toBeInTheDocument();
        expect(screen.getByLabelText(messages.common.form.name)).toBeInTheDocument();
        expect(screen.getByLabelText(messages.common.form.email)).toBeInTheDocument();
    });

    it('pins the request locale for static rendering', async () => {
        await ExampleFormPage({ params });

        expect(setRequestLocale).toHaveBeenCalledWith('en');
    });

    it('answers 404 for a locale the routing does not serve', async () => {
        const notFound = { digest: expect.stringContaining('404') as unknown };

        await expect(generateMetadata({ params: unknownLocale })).rejects.toMatchObject(notFound);
        await expect(ExampleFormPage({ params: unknownLocale })).rejects.toMatchObject(notFound);
    });
});
