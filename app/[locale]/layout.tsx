import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

import { requireLocale } from '@/i18n/request-locale';
import { routing } from '@/i18n/routing';
import { Footer, Header } from '@/shared/ui';

export const generateStaticParams = () => {
    return routing.locales.map((locale) => ({ locale }));
};

type LocaleLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export const generateMetadata = async ({
    params
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> => {
    const { locale: rawLocale } = await params;
    const locale = requireLocale(rawLocale);
    const t = await getTranslations({ locale, namespace: 'meta.root' });
    return {
        description: t('description'),
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

const LocaleLayout = async ({ children, params }: LocaleLayoutProps) => {
    const { locale: rawLocale } = await params;
    const locale = requireLocale(rawLocale);
    setRequestLocale(locale);
    const messages = await getMessages();

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
            </div>
        </NextIntlClientProvider>
    );
};

export default LocaleLayout;
