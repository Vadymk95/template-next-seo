import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
    title: 'UI Playground',
    description: 'Development playground for UI components',
    robots: {
        index: false,
        follow: false
    }
};

const DevPlaygroundLayout = ({ children }: { children: React.ReactNode }) => {
    if (process.env.NODE_ENV === 'production') {
        notFound();
    }

    return children;
};

export default DevPlaygroundLayout;
