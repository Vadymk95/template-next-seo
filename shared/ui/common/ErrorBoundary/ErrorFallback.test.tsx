import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import { ErrorFallback } from './ErrorFallback';

const SECRET_MESSAGE = 'database password is hunter2';
const STACK_FRAME = 'at leakyQuery (/srv/app/server/db.ts:42:7)';

const renderFallback = () => {
    const error = new Error(SECRET_MESSAGE);
    error.stack = `Error: ${SECRET_MESSAGE}\n    ${STACK_FRAME}`;

    return renderWithProviders(
        <ErrorFallback error={error} onReset={vi.fn()} onReload={vi.fn()} />
    );
};

describe('ErrorFallback', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('shows no error message, stack trace or details disclosure in production', () => {
        vi.stubEnv('NODE_ENV', 'production');

        const { container } = renderFallback();

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.queryByText(/error details/i)).not.toBeInTheDocument();
        expect(container.querySelector('details')).toBeNull();
        expect(container.querySelector('pre')).toBeNull();
        expect(container).not.toHaveTextContent(SECRET_MESSAGE);
        expect(container).not.toHaveTextContent(STACK_FRAME);
    });

    it('shows the error message and stack trace in development', () => {
        vi.stubEnv('NODE_ENV', 'development');

        const { container } = renderFallback();

        expect(screen.getByText(/error details/i)).toBeInTheDocument();
        expect(container.querySelector('pre')).toHaveTextContent(SECRET_MESSAGE);
        expect(container.querySelector('pre')).toHaveTextContent(STACK_FRAME);
    });
});
