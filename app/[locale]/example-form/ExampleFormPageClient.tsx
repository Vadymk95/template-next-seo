'use client';

import { useTranslations } from 'next-intl';

import { ExampleForm } from '@/features/example-form';

export const ExampleFormPageClient = () => {
    const t = useTranslations('common');

    return (
        <div className="container py-10">
            <div className="mx-auto max-w-2xl">
                <h1 className="mb-6 text-3xl font-bold">{t('page.exampleForm.title')}</h1>
                <p className="mb-8 text-muted-foreground">{t('page.exampleForm.description')}</p>
                <ExampleForm />
            </div>
        </div>
    );
};
