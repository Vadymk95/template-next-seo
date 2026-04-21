'use client';

import { useTranslations } from 'next-intl';

export const HomePageClient = () => {
    const t = useTranslations('home');

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold">{t('title')}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
        </div>
    );
};
