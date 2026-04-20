import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { routing } from '@/i18n/routing';

import { ExampleFormPageClient } from './ExampleFormPageClient';

// ISR: Revalidate every 30 minutes
export const revalidate = 1800;

type ExampleFormPageProps = {
    params: Promise<{ locale: string }>;
};

export const generateMetadata = async ({ params }: ExampleFormPageProps): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'meta.exampleForm' });
    const languages = Object.fromEntries(
        routing.locales.map((l) => [l, `/${l}/example-form`])
    ) as Record<string, string>;

    return {
        title: t('title'),
        description: t('description'),
        alternates: {
            canonical: `/${locale}/example-form`,
            languages
        }
    };
};

const ExampleFormPage = async ({ params }: ExampleFormPageProps) => {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ExampleFormPageClient />;
};

export default ExampleFormPage;
