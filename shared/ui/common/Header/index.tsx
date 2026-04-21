'use client';

import { useTranslations } from 'next-intl';

import { SmartLink } from '@/shared/ui/common/SmartLink';

export const Header = () => {
    const t = useTranslations('common');

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <SmartLink href="/" className="flex items-center space-x-2">
                    <span className="text-xl font-bold">{t('navigation.home')}</span>
                </SmartLink>

                <nav className="flex items-center space-x-6">
                    <SmartLink
                        href="/"
                        className="text-sm font-medium transition-colors hover:text-primary"
                    >
                        {t('navigation.home')}
                    </SmartLink>
                    <SmartLink
                        href="/example-form"
                        className="text-sm font-medium transition-colors hover:text-primary"
                    >
                        Example Form
                    </SmartLink>
                    {process.env.NODE_ENV === 'development' && (
                        <a
                            href="/dev/ui"
                            className="text-sm font-medium transition-colors hover:text-primary"
                        >
                            Dev UI
                        </a>
                    )}
                </nav>
            </div>
        </header>
    );
};
