import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

import { requireLocale } from '@/i18n/request-locale';

/*
 * The social preview image for the `[locale]` segment (the home page). Next adds `og:image` and
 * `twitter:image` from this file on its own, so a page needs no `images` entry. TEMPLATE PLACEHOLDER
 * (restyle on fork): the layout below is a plain site-name card. A page that needs its own picture
 * gets its own `opengraph-image.tsx` next to its `page.tsx`.
 *
 * A page that states its own `openGraph` (see `buildPageMetadata`) replaces the layout's object,
 * image included, so it needs an `opengraph-image.tsx` beside it too. The one-line re-export in
 * `example-form/` shows the shape (an `@/app/[locale]/opengraph-image` re-export).
 * A locale whose script the default font cannot draw needs a `fonts` entry in the options below
 * (Next docs, "Custom fonts" in the `ImageResponse` reference).
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface OpenGraphImageProps {
    params: Promise<{ locale: string }>;
}

const OpenGraphImage = async ({ params }: OpenGraphImageProps): Promise<ImageResponse> => {
    const { locale: rawLocale } = await params;
    const locale = requireLocale(rawLocale);
    const t = await getTranslations({ locale, namespace: 'meta.root' });

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: 96,
                background: '#0f172a',
                color: '#f8fafc'
            }}
        >
            <div style={{ fontSize: 80, fontWeight: 700 }}>{t('siteName')}</div>
            <div style={{ fontSize: 36, marginTop: 24, color: '#94a3b8' }}>{t('description')}</div>
        </div>,
        size
    );
};

export default OpenGraphImage;
