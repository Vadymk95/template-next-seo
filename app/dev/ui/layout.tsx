import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import '@/app/globals.css';

export const metadata: Metadata = {
    title: 'UI Playground',
    description: 'Development playground for UI components',
    robots: {
        index: false,
        follow: false
    }
};

// A root layout of its own: the locale layout is the other one, and this route sits outside it.
// The font variable and the dark theme are the ones the stylesheet and the components expect.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const DevPlaygroundLayout = ({ children }: { children: React.ReactNode }): ReactElement => {
    if (process.env.NODE_ENV === 'production') {
        notFound();
    }

    return (
        <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
            <body>{children}</body>
        </html>
    );
};

export default DevPlaygroundLayout;
