import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import '@/app/globals.css';
import { Providers } from '@/app/providers';
import { WebVitalsReporter } from '@/app/WebVitalsReporter';
import { requireLocale } from '@/i18n/request-locale';
import { routing } from '@/i18n/routing';
import { getPublicEnv } from '@/shared/lib/env';
import { Footer, Header } from '@/shared/ui';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
    preload: true,
    adjustFontFallback: true,
    fallback: ['system-ui', 'arial']
});

export const generateStaticParams = (): { locale: (typeof routing.locales)[number] }[] => {
    return routing.locales.map((locale) => ({ locale }));
};

interface LocaleLayoutProps {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}

export const generateMetadata = async ({
    params
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> => {
    const { locale: rawLocale } = await params;
    const locale = requireLocale(rawLocale);
    const t = await getTranslations({ locale, namespace: 'meta.root' });
    return {
        metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_APP_URL),
        // TEMPLATE PLACEHOLDER (rename on fork): keywords, authors, creator; the brand is in the
        // `meta.root` messages. Full list of spots to change: README "Forking — rename checklist".
        // Next applies `title.template` to the segments below this one, never to this segment's own
        // page, so the home page states its whole title (`buildPageMetadata`).
        title: { default: t('titleDefault'), template: t('titleTemplate') },
        description: t('description'),
        keywords: ['React', 'Next.js', 'TypeScript', 'SEO'],
        authors: [{ name: 'Your Name' }],
        creator: 'Your Name',
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1
            }
        },
        openGraph: {
            type: 'website',
            locale,
            siteName: t('siteName'),
            title: t('titleDefault'),
            description: t('description')
        },
        twitter: {
            card: 'summary_large_image',
            title: t('titleDefault'),
            description: t('description')
        }
    };
};

// The root layout: the locale segment sits above every localized page, so `next/root-params` can
// hand the locale to `i18n/request.ts` and no entry has to pin it.
const LocaleLayout = async ({ children, params }: LocaleLayoutProps): Promise<ReactElement> => {
    const { locale: rawLocale } = await params;
    const locale = requireLocale(rawLocale);
    const messages = await getMessages();

    return (
        <html lang={locale} className={`${inter.variable} dark`} suppressHydrationWarning>
            <body>
                <WebVitalsReporter />
                <Providers>
                    <NextIntlClientProvider locale={locale} messages={messages}>
                        <div className="flex min-h-screen flex-col">
                            <Header />
                            <main className="flex-1">{children}</main>
                            <Footer />
                        </div>
                    </NextIntlClientProvider>
                </Providers>
            </body>
        </html>
    );
};

export default LocaleLayout;
