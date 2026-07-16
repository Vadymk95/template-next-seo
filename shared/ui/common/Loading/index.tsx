'use client';

import type { ReactElement } from 'react';
export const Loading = (): ReactElement => {
    return (
        <div
            className="flex min-h-screen items-center justify-center"
            role="status"
            aria-live="polite"
        >
            <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
                aria-hidden="true"
            />
        </div>
    );
};
