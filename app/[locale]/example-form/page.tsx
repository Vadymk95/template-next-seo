import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import type { ReactElement } from 'react';

import { requireLocale } from '@/i18n/request-locale';
import { buildPageMetadata } from '@/shared/lib/pageMetadata';

import { ExampleFormPageClient } from './ExampleFormPageClient';

// ISR: Revalidate every 30 minutes
export const revalidate = 1800;

interface ExampleFormPageProps {
    params: Promise<{ locale: string }>;
}

export const generateMetadata = async ({ params }: ExampleFormPageProps): Promise<Metadata> => {
    const { locale: rawLocale } = await params;
    return buildPageMetadata({
        locale: requireLocale(rawLocale),
        page: 'exampleForm',
        path: '/example-form'
    });
};

const ExampleFormPage = async ({ params }: ExampleFormPageProps): Promise<ReactElement> => {
    const { locale: rawLocale } = await params;
    const locale = requireLocale(rawLocale);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the static-rendering call every localized entry keeps; moving to next/root-params is a routing migration, not a lint fix
    setRequestLocale(locale);
    return <ExampleFormPageClient />;
};

export default ExampleFormPage;
