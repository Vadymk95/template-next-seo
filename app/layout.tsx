import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Footer, Header } from '@/shared/ui';

import './globals.css';
import { PreconnectResources } from './PreconnectResources';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: {
        default: 'React Enterprise Foundation',
        template: '%s | React Enterprise Foundation'
    },
    description: 'Production-ready React/Next.js foundation optimized for SEO and performance',
    keywords: ['React', 'Next.js', 'TypeScript', 'SEO'],
    authors: [{ name: 'Your Name' }],
    creator: 'Your Name',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://yourdomain.com',
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
        <html lang="en" className={`${inter.variable} dark i18n-loading`}>
            <body>
                <PreconnectResources />
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
