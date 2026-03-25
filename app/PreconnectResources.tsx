'use client';

import { useEffect } from 'react';

const PRECONNECT_URLS = [
    { href: 'https://www.googletagmanager.com', crossOrigin: 'anonymous' },
    { href: 'https://fonts.googleapis.com', crossOrigin: 'anonymous' },
    { href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' }
];

export const PreconnectResources = () => {
    useEffect(() => {
        // Add preconnect links to head for early connection establishment
        PRECONNECT_URLS.forEach(({ href, crossOrigin }) => {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = href;
            if (crossOrigin) {
                link.crossOrigin = crossOrigin;
            }
            document.head.appendChild(link);
        });
    }, []);

    return null;
};
