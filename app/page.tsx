import type { Metadata } from 'next';

import { HomePageClient } from './HomePageClient';

export const metadata: Metadata = {
    title: 'Home',
    description: 'Welcome to React Enterprise Foundation'
};

// ISR: Revalidate every hour
export const revalidate = 3600;

const HomePage = () => {
    return <HomePageClient />;
};

export default HomePage;
