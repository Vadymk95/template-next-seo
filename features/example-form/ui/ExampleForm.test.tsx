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

// The form reads the locale it renders in from next-intl; the provider in these tests only offers
// the one declared locale, so a second one is stubbed to tell the two sources apart.
vi.mock('next-intl', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useLocale: (): string => 'de'
}));

describe('ExampleForm', () => {
    // A Server Action cannot read the locale from the request (`next/root-params` throws there), so
    // the form sends the locale it renders in.
    it('tells the action which locale the page is rendered in', async () => {
        vi.mocked(exampleFormAction).mockResolvedValue({
            success: true,
            message: messages.common.form.submittedSuccessfully,
            data: { name: 'Ada Lovelace', email: 'ada@example.com' }
        });
        renderWithProviders(<ExampleForm />);

        fireEvent.change(screen.getByLabelText(messages.common.form.name), {
            target: { value: 'Ada Lovelace' }
        });
        fireEvent.change(screen.getByLabelText(messages.common.form.email), {
            target: { value: 'ada@example.com' }
        });
        fireEvent.click(screen.getByRole('button', { name: messages.common.button.submit }));
        await screen.findByRole('status');

        expect(exampleFormAction).toHaveBeenCalledOnce();
        const sent = vi.mocked(exampleFormAction).mock.calls[0]?.[0];
        expect(sent?.get('locale')).toBe('de');
    });

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
