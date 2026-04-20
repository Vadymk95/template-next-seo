'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui';

const NotFound = () => {
    const { t } = useTranslation(['common', 'errors']);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="max-w-md space-y-4 text-center">
                <h1 className="text-6xl font-bold">404</h1>
                <h2 className="text-2xl font-semibold">{t('errors:page.404')}</h2>
                <p className="text-muted-foreground">{t('errors:page.notFound')}</p>
                <Link href="/">
                    <Button>{t('common:button.goBackHome')}</Button>
                </Link>
            </div>
        </div>
    );
};

export default NotFound;
