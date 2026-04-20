'use client';

import { useTranslation } from 'react-i18next';

export const HomePageClient = () => {
    const { t } = useTranslation(['common', 'home']);

    return (
        <div className="container py-10">
            <h1 className="text-4xl font-bold">{t('home:title')}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t('home:description')}</p>
        </div>
    );
};
