import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { getPublicEnv } from '@/shared/lib/env';
import { Footer, Header } from '@/shared/ui';

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
    title: {
        default: 'React Enterprise Foundation',
        template: '%s | React Enterprise Foundation'
    },
    description: 'Production-ready React/Next.js foundation optimized for SEO and performance',
    keywords: ['React', 'Next.js', 'TypeScript', 'SEO'],
    authors: [{ name: 'Your Name' }],
    creator: 'Your Name',
    alternates: {
        canonical: '/'
    },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: '/',
        siteName: 'React Enterprise Foundation',
        title: 'React Enterprise Foundation',
        description: 'Production-ready React/Next.js foundation optimized for SEO and performance'
    },
    twitter: {
        card: 'summary_large_image',
        title: 'React Enterprise Foundation',
        description: 'Production-ready React/Next.js foundation optimized for SEO and performance'
    },
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
                <Providers>
                    <div className="flex min-h-screen flex-col">
                        <Header />
                        <main className="flex-1">{children}</main>
                        <Footer />
                    </div>
                </Providers>
            </body>
        </html>
    );
};

export default RootLayout;
