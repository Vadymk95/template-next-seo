'use client';

import type { ReactElement } from 'react';
export const Loading = (): ReactElement => {
    return (
        <output className="flex min-h-screen items-center justify-center">
            <div
                className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
                aria-hidden="true"
            />
        </output>
    );
};
