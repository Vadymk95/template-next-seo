import { fireEvent, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { exampleFormAction } from '@/app/actions/example-form';
import messages from '@/messages/en.json';
import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import { ExampleForm } from './ExampleForm';

// The real action sleeps for a second and resolves server-side translations; the subject here is how
// the form presents the result it gets back.
vi.mock('@/app/actions/example-form', () => ({ exampleFormAction: vi.fn() }));

/*
 * `@/shared/ui` is a barrel, so importing Button and Input also loads `SmartLink`, whose next-intl
 * navigation needs `next/navigation` — not resolvable in jsdom. Same stand-in as `Header.test.tsx`.
 */
vi.mock('@/shared/ui/common/SmartLink', () => ({
    SmartLink: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>): ReactElement => (
        <a {...props}>{children}</a>
    )
}));

describe('ExampleForm', () => {
    it('announces a successful submit through a status region that appears only after it', async () => {
        const name = 'Ada Lovelace';
        const email = 'ada@example.com';
        vi.mocked(exampleFormAction).mockResolvedValue({
            success: true,
            message: messages.common.form.submittedSuccessfully,
            data: { name, email }
        });
        renderWithProviders(<ExampleForm />);

        expect(screen.queryByRole('status')).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(messages.common.form.name), {
            target: { value: name }
        });
        fireEvent.change(screen.getByLabelText(messages.common.form.email), {
            target: { value: email }
        });
        fireEvent.click(screen.getByRole('button', { name: messages.common.button.submit }));

        expect(await screen.findByRole('status')).toHaveTextContent(
            messages.common.form.submittedSuccessfully
        );
    });
});
