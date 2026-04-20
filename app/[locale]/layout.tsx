import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

import { routing } from '@/i18n/routing';
import { Footer, Header } from '@/shared/ui';

export const generateStaticParams = () => {
    return routing.locales.map((locale) => ({ locale }));
};

type LocaleLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

const LocaleLayout = async ({ children, params }: LocaleLayoutProps) => {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }
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
