import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
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
    const { locale: rawLocale } = await params;
    const locale = requireLocale(rawLocale);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the static-rendering call every localized entry keeps; moving to next/root-params is a routing migration, not a lint fix
    setRequestLocale(locale);
    return <StartPage />;
};

export default HomePage;
