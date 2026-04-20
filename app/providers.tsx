'use client';

import { useEffect, type FunctionComponent, type ReactNode } from 'react';

export const Providers: FunctionComponent<{ children: ReactNode }> = ({ children }) => {
    useEffect(() => {
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

    return <>{children}</>;
};
