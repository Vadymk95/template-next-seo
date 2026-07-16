import type { ReactNode, ReactElement } from 'react';
import { Suspense } from 'react';

interface WithSuspenseOptions {
    showLoader?: boolean;
    fallback?: ReactNode;
}

export const WithSuspense = (
    element: ReactNode,
    options: WithSuspenseOptions = { showLoader: true }
): ReactElement => {
    const fallback = options.fallback ?? (options.showLoader ? <div>Loading...</div> : null);

    return <Suspense fallback={fallback}>{element}</Suspense>;
};
