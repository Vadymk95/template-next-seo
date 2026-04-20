'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

export const Footer = () => {
    const t = useTranslations('common');

    return (
        <footer className="border-t bg-background">
            <div className="container py-8">
                <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                    <div className="flex flex-col items-center gap-2 md:items-start">
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} React Enterprise Foundation. All rights
                            reserved.
                        </p>
                    </div>
                    <nav className="flex items-center space-x-6">
                        <Link
                            href="/"
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t('navigation.home')}
                        </Link>
                        <Link
                            href="/example-form"
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Example Form
                        </Link>
                    </nav>
                </div>
            </div>
        </footer>
    );
};
