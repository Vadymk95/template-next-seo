import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { getPublicEnv } from '@/shared/lib/env';

import './globals.css';
import { Providers } from './providers';
import { WebVitalsReporter } from './WebVitalsReporter';

const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
const metadataBase = new URL(NEXT_PUBLIC_APP_URL);

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
    preload: true,
    adjustFontFallback: true,
    fallback: ['system-ui', 'arial']
});

export const metadata: Metadata = {
    metadataBase,
    keywords: ['React', 'Next.js', 'TypeScript', 'SEO'],
    authors: [{ name: 'Your Name' }],
    creator: 'Your Name',
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1
        }
    }
};

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
    return (
        <html lang="en" className={`${inter.variable} dark i18n-loading`} suppressHydrationWarning>
            <head>
                <link
                    rel="preconnect"
                    href="https://www.googletagmanager.com"
                    crossOrigin="anonymous"
                />
                <link
                    rel="preconnect"
                    href="https://fonts.googleapis.com"
                    crossOrigin="anonymous"
                />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body>
                <WebVitalsReporter />
                <Providers>{children}</Providers>
            </body>
        </html>
    );
};

export default RootLayout;
