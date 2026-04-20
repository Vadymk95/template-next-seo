import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import { HomePageClient } from './HomePageClient';

export const metadata: Metadata = {
    title: 'Home',
    description: 'Welcome to React Enterprise Foundation',
    alternates: {
        canonical: '/'
    }
};

// ISR: Revalidate every hour
export const revalidate = 3600;

type HomePageProps = {
    params: Promise<{ locale: string }>;
};

const HomePage = async ({ params }: HomePageProps) => {
    const { locale } = await params;
    setRequestLocale(locale);
    return <HomePageClient />;
};

export default HomePage;
