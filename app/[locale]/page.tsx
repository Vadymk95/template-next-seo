import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { requireLocale } from '@/i18n/request-locale';
import { buildPageMetadata } from '@/shared/lib/pageMetadata';

import { StartPage } from './StartPage';

// ISR: Revalidate every hour
export const revalidate = 3600;

interface HomePageProps {
    params: Promise<{ locale: string }>;
}

export const generateMetadata = async ({ params }: HomePageProps): Promise<Metadata> => {
    const { locale: rawLocale } = await params;
    return buildPageMetadata({ locale: requireLocale(rawLocale), page: 'home', path: '' });
};

const HomePage = async ({ params }: HomePageProps): Promise<ReactElement> => {
    // A page renders beside its layout, not after it: it narrows the route param itself.
    const { locale: rawLocale } = await params;
    requireLocale(rawLocale);
    return <StartPage />;
};

export default HomePage;
