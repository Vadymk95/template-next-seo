'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { Button } from '@/shared/ui';

const NotFound = () => {
    const tCommon = useTranslations('common');
    const tErrors = useTranslations('errors');

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="max-w-md space-y-4 text-center">
                <h1 className="text-6xl font-bold">404</h1>
                <h2 className="text-2xl font-semibold">{tErrors('page.404')}</h2>
                <p className="text-muted-foreground">{tErrors('page.notFound')}</p>
                <Link href="/">
                    <Button>{tCommon('button.goBackHome')}</Button>
                </Link>
            </div>
        </div>
    );
};

export default NotFound;
