import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing } from '@/i18n/routing';

import { HomePageClient } from './HomePageClient';

// ISR: Revalidate every hour
export const revalidate = 3600;

type HomePageProps = {
    params: Promise<{ locale: string }>;
};

export const generateMetadata = async ({ params }: HomePageProps): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'meta.home' });
    const languages = Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) as Record<
        string,
        string
    >;
    return {
        title: t('title'),
        description: t('description'),
        alternates: {
            canonical: `/${locale}`,
            languages
        }
    };
};

const HomePage = async ({ params }: HomePageProps) => {
    const { locale } = await params;
    setRequestLocale(locale);
    return <HomePageClient />;
};

export default HomePage;
