'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type FC, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n, { i18nInitPromise } from '@/shared/lib/i18n';
import { createQueryClient } from '@/shared/lib/queryClient';
import { reportWebVitals, reportWebVitalsToConsole } from '@/shared/lib/web-vitals';
import { Loading } from '@/shared/ui';

export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
    const [queryClient] = useState(() => createQueryClient());
    const [isI18nReady, setIsI18nReady] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        const initI18n = async () => {
            if (!i18n.isInitialized) {
                try {
                    await i18nInitPromise;
                } catch (error) {
                    console.error('[i18n] Failed to initialize:', error);
                }
            }
            if (i18n.isInitialized && i18n.hasResourceBundle(i18n.language, 'common')) {
                setIsI18nReady(true);
            } else {
                await new Promise((resolve) => requestAnimationFrame(resolve));
                setIsI18nReady(true);
            }
        };

        initI18n();
        reportWebVitals(reportWebVitalsToConsole);

        // Deferred analytics initialization (if used)
        const initAnalytics = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(
                    () => {
                        // Initialize analytics here if needed
                        // Example: gtag('config', 'GA_MEASUREMENT_ID');
                    },
                    { timeout: 2000 }
                );
            } else {
                setTimeout(() => {
                    // Initialize analytics here if needed
                }, 100);
            }
        };

        if (document.readyState === 'complete') {
            initAnalytics();
        } else {
            window.addEventListener('load', initAnalytics, { once: true });
        }
    }, []);

    // Show loading state while i18n initializes (only on client, after mount)
    if (isMounted && !isI18nReady) {
        return <Loading />;
    }

    return (
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </I18nextProvider>
    );
};
