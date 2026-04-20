'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { logger } from '@/shared/lib/logger';
import { Button } from '@/shared/ui';

const Error = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
    const tCommon = useTranslations('common');
    const tErrors = useTranslations('errors');

    useEffect(() => {
        logger.error('Route error occurred', error, {
            digest: error.digest,
            path: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
        });
    }, [error]);

    return (
        <section
            role="alert"
            aria-live="assertive"
            className="flex min-h-screen flex-col items-center justify-center p-4"
        >
            <div className="max-w-md space-y-4 text-center">
                <h1 className="text-2xl font-bold">{tErrors('page.errorTitle')}</h1>
                <p className="text-muted-foreground">{tErrors('page.errorDescription')}</p>

                {process.env.NODE_ENV === 'development' && error && (
                    <details className="mt-4 text-left">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                            {tErrors('page.errorDetails')}
                        </summary>
                        <pre className="mt-2 overflow-auto rounded-md bg-muted p-4 text-xs">
                            {error.message}
                            {'\n\n'}
                            {error.stack}
                        </pre>
                    </details>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button onClick={reset} variant="default">
                        {tCommon('button.tryAgain')}
                    </Button>
                    <Button onClick={() => window.location.reload()} variant="outline">
                        {tCommon('button.reloadPage')}
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default Error;
