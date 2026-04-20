'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

export const Header = () => {
    const t = useTranslations('common');

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <Link href="/" className="flex items-center space-x-2">
                    <span className="text-xl font-bold">{t('navigation.home')}</span>
                </Link>

                <nav className="flex items-center space-x-6">
                    <Link
                        href="/"
                        className="text-sm font-medium transition-colors hover:text-primary"
                    >
                        {t('navigation.home')}
                    </Link>
                    <Link
                        href="/example-form"
                        className="text-sm font-medium transition-colors hover:text-primary"
                    >
                        Example Form
                    </Link>
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
