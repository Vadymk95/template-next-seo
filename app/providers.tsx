'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type FunctionComponent, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n, { i18nInitPromise } from '@/shared/lib/i18n';
import { logger } from '@/shared/lib/logger';
import { createQueryClient } from '@/shared/lib/queryClient';
import { Loading } from '@/shared/ui';

export const Providers: FunctionComponent<{ children: ReactNode }> = ({ children }) => {
    const [queryClient] = useState(() => createQueryClient());
    const [isI18nReady, setIsI18nReady] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // Client-only mount flag for i18n shell; synchronous setState in effect is intentional here.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate before i18n init
        setIsMounted(true);

        const initI18n = async () => {
            if (!i18n.isInitialized) {
                try {
                    await i18nInitPromise;
                } catch (error) {
                    logger.error(
                        '[providers] i18n init failed',
                        error instanceof Error ? error : new Error(String(error))
                    );
                }
            }
            setIsI18nReady(true);
        };

        void initI18n();

        const initAnalytics = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(
                    () => {
                        // Initialize analytics here if needed
                    },
                    { timeout: 2000 }
                );
            } else {
                setTimeout(() => {
                    // Initialize analytics here if needed
                }, 0);
            }
        };

        if (document.readyState === 'complete') {
            initAnalytics();
        } else {
            window.addEventListener('load', initAnalytics, { once: true });
        }
    }, []);

    if (isMounted && !isI18nReady) {
        return <Loading />;
    }

    return (
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </I18nextProvider>
    );
};
