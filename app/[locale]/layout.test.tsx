import { NextIntlClientProvider } from 'next-intl';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Providers } from '@/app/providers';
import { WebVitalsReporter } from '@/app/WebVitalsReporter';
import messages from '@/messages/en.json';
import { getPublicEnv } from '@/shared/lib/env';
import { Footer, Header } from '@/shared/ui';

import LocaleLayout, { generateMetadata, generateStaticParams } from './layout';

/*
 * The locale layout is the root layout: it renders the document, so what it renders and what it
 * declares is the subject, and the element tree it returns is read instead of rendered (jsdom would
 * refuse an `<html>` inside a `<div>`). The font loader is a build-time transform, `next-intl/server`
 * needs the per-request context jsdom lacks, and `@/shared/ui` is a barrel that loads next-intl
 * navigation, so each gets a stand-in. Routing declares two locales here, so a layout that hard-codes
 * the language shows.
 */
vi.mock('next/font/google', () => ({ Inter: () => ({ variable: 'font-inter-variable' }) }));

vi.mock('next-intl/server', () => ({
    getMessages: () => Promise.resolve(messages),
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

vi.mock('@/shared/ui', () => ({
    Header: (): null => null,
    Footer: (): null => null
}));

vi.mock('@/i18n/routing', () => ({
    routing: { locales: ['en', 'de'], defaultLocale: 'en' }
}));

interface TreeProps {
    children?: ReactNode;
    className?: string;
    lang?: string;
    locale?: string;
    messages?: unknown;
    suppressHydrationWarning?: boolean;
}

const propsOf = (element: ReactElement): TreeProps => element.props as TreeProps;

const elementsIn = (node: ReactNode): ReactElement[] => {
    if (Array.isArray(node)) return node.flatMap(elementsIn);
    if (!isValidElement(node)) return [];
    return [node, ...elementsIn(propsOf(node).children)];
};

const renderLayout = async (locale: string, page: ReactNode = <p>page</p>): Promise<ReactElement> =>
    LocaleLayout({ children: page, params: Promise.resolve({ locale }) });

const typesIn = (root: ReactElement): unknown[] => elementsIn(root).map(({ type }) => type);

const notFound = { digest: expect.stringContaining('404') as unknown };

describe('locale layout as the root layout', () => {
    it.each(['en', 'de'])(
        'declares the document language of the locale it serves: %s',
        async (locale) => {
            const tree = await renderLayout(locale);

            expect(tree.type).toBe('html');
            expect(propsOf(tree).lang).toBe(locale);
        }
    );

    it('carries the font variable, the dark theme and the hydration opt-out on the document', async () => {
        const { className, suppressHydrationWarning } = propsOf(await renderLayout('en'));

        expect(className).toContain('font-inter-variable');
        expect(className?.split(' ')).toContain('dark');
        // Browser extensions and a theme script change attributes on `<html>` before React hydrates it.
        expect(suppressHydrationWarning).toBe(true);
    });

    it('renders the web vitals reporter and the providers inside the body', async () => {
        const tree = await renderLayout('en');
        const body = elementsIn(propsOf(tree).children).find(({ type }) => type === 'body');

        expect(body).toBeDefined();
        const inBody = typesIn(body!);
        expect(inBody).toContain(WebVitalsReporter);
        expect(inBody).toContain(Providers);
    });

    it('wraps the header, the page and the footer in the intl provider with its locale and messages', async () => {
        const page = <p>page</p>;
        const tree = await renderLayout('de', page);
        const provider = elementsIn(tree).find(({ type }) => type === NextIntlClientProvider);

        expect(provider).toBeDefined();
        expect(propsOf(provider!).locale).toBe('de');
        expect(propsOf(provider!).messages).toBe(messages);

        const inside = elementsIn(propsOf(provider!).children);
        expect(inside.map(({ type }) => type)).toEqual(
            expect.arrayContaining([Header, 'main', Footer])
        );
        const main = inside.find(({ type }) => type === 'main');
        expect(propsOf(main!).children).toBe(page);
    });

    it('answers 404 for a locale the routing does not serve', async () => {
        await expect(renderLayout('xx')).rejects.toMatchObject(notFound);
        await expect(
            generateMetadata({ params: Promise.resolve({ locale: 'xx' }) })
        ).rejects.toMatchObject(notFound);
    });
});

describe('locale layout metadata', () => {
    const params = Promise.resolve({ locale: 'en' });

    // The pages below the locale segment inherit this template; Next never applies it to the page of
    // the segment that defines it, which is why the home page states its own full title.
    it('defines the title default and the template the pages below inherit', async () => {
        const { title } = await generateMetadata({ params });

        expect(title).toEqual({
            default: messages.meta.root.titleDefault,
            template: messages.meta.root.titleTemplate
        });
        expect(messages.meta.root.titleTemplate).toContain('%s');
    });

    it('keeps the site-wide document metadata the old root layout held', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.metadataBase).toEqual(new URL(getPublicEnv().NEXT_PUBLIC_APP_URL));
        expect(metadata.robots).toMatchObject({ index: true, follow: true });
        expect(metadata.keywords?.length).toBeGreaterThan(0);
        expect(metadata.authors).toHaveLength(1);
        expect(metadata.creator).toBeTruthy();
    });

    it('describes the locale in the description and the social cards', async () => {
        const metadata = await generateMetadata({ params });

        expect(metadata.description).toBe(messages.meta.root.description);
        expect(metadata.openGraph).toMatchObject({
            type: 'website',
            locale: 'en',
            siteName: messages.meta.root.siteName,
            title: messages.meta.root.titleDefault
        });
        expect(metadata.twitter).toMatchObject({ title: messages.meta.root.titleDefault });
    });
});

describe('locale layout static params', () => {
    it('lists one entry per locale the routing declares', () => {
        expect(generateStaticParams()).toEqual([{ locale: 'en' }, { locale: 'de' }]);
    });
});
