import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import type messages from '@/messages/en.json';

/** A page's own section under `meta` in the messages (`root` is the site-wide one). */
export type MetaPage = Exclude<keyof (typeof messages)['meta'], 'root'>;

interface PageMetadataInput {
    locale: Locale;
    /** The `meta.<page>` section that holds this page's title and description. */
    page: MetaPage;
    /** The route below the locale segment: `''` for the home page, `'/example-form'` for a child. */
    path: string;
}

/**
 * Every localized page's metadata: title, description, canonical and `hreflang` alternates, plus its
 * own Open Graph and Twitter text.
 *
 * Next merges metadata one key deep, so a page that exports `openGraph` replaces the locale layout's
 * whole object and a page that does not shows the layout's preview on every route. A page therefore
 * states its own preview here and carries `type`, `locale` and `siteName` itself. The image comes from
 * the `opengraph-image` file convention, which Next adds to the tags on its own.
 */
export const buildPageMetadata = async ({
    locale,
    page,
    path
}: PageMetadataInput): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: `meta.${page}` });
    const root = await getTranslations({ locale, namespace: 'meta.root' });
    const url = `/${locale}${path}`;
    const title = t('title');
    const description = t('description');
    const languages = Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])) as Record<
        string,
        string
    >;

    return {
        title,
        description,
        alternates: { canonical: url, languages },
        openGraph: {
            type: 'website',
            locale,
            siteName: root('siteName'),
            title,
            description,
            url
        },
        twitter: { card: 'summary_large_image', title, description }
    };
};
