'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import {
    CHROME_BRAND_LABEL,
    CHROME_BRAND_LINK,
    CHROME_NAV_LINK
} from '@/shared/ui/common/chromeLink';
import { SmartLink } from '@/shared/ui/common/SmartLink';

export const Header = (): ReactElement => {
    const t = useTranslations('common');

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
            <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
                <SmartLink href="/" className={CHROME_BRAND_LINK}>
                    <span className={CHROME_BRAND_LABEL}>{t('navigation.home')}</span>
                </SmartLink>

                <nav className="flex min-w-0 flex-wrap items-center gap-x-6">
                    <SmartLink href="/" className={CHROME_NAV_LINK}>
                        {t('navigation.home')}
                    </SmartLink>
                    <SmartLink href="/example-form" className={CHROME_NAV_LINK}>
                        Example Form
                    </SmartLink>
                    {process.env.NODE_ENV === 'development' && (
                        <a href="/dev/ui" className={CHROME_NAV_LINK}>
                            Dev UI
                        </a>
                    )}
                </nav>
            </div>
        </header>
    );
};
