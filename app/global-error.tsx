'use client';

import { logger } from '@/shared/lib/logger';

export default function GlobalError({
    error,
    reset
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    logger.error('[global-error]', error);

    return (
        <html lang="en">
            <body>
                <h1>Something went wrong</h1>
                <button type="button" onClick={reset}>
                    Try again
                </button>
            </body>
        </html>
    );
}
