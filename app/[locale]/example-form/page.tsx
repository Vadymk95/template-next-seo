import type { Metadata } from 'next';
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
    // A page renders beside its layout, not after it: it narrows the route param itself.
    const { locale: rawLocale } = await params;
    requireLocale(rawLocale);
    return <ExampleFormPageClient />;
};

export default ExampleFormPage;
