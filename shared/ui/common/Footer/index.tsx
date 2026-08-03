'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { CHROME_MUTED_LINK } from '@/shared/ui/common/chromeLink';
import { SmartLink } from '@/shared/ui/common/SmartLink';

export const Footer = (): ReactElement => {
    const t = useTranslations('common');

    return (
        <footer className="border-t bg-background">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                    <div className="flex flex-col items-center gap-2 md:items-start">
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} React Enterprise Foundation. All rights
                            reserved.
                        </p>
                    </div>
                    <nav className="flex min-w-0 flex-wrap items-center gap-x-6">
                        <SmartLink href="/" className={CHROME_MUTED_LINK}>
                            {t('navigation.home')}
                        </SmartLink>
                        <SmartLink href="/example-form" className={CHROME_MUTED_LINK}>
                            Example Form
                        </SmartLink>
                    </nav>
                </div>
            </div>
        </footer>
    );
};
