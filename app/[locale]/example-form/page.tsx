import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import { ExampleFormPageClient } from './ExampleFormPageClient';

export const metadata: Metadata = {
    title: 'Example Form',
    description: 'Example form with Server Actions and validation',
    alternates: {
        canonical: '/example-form'
    }
};

// ISR: Revalidate every 30 minutes
export const revalidate = 1800;

type ExampleFormPageProps = {
    params: Promise<{ locale: string }>;
};

const ExampleFormPage = async ({ params }: ExampleFormPageProps) => {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ExampleFormPageClient />;
};

export default ExampleFormPage;
