import type { Metadata } from 'next';

import { ExampleFormPageClient } from './ExampleFormPageClient';

export const metadata: Metadata = {
    title: 'Example Form',
    description: 'Example form with Server Actions and validation'
};

// ISR: Revalidate every 30 minutes
export const revalidate = 1800;

const ExampleFormPage = () => {
    return <ExampleFormPageClient />;
};

export default ExampleFormPage;
