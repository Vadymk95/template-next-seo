import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';
import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import { ContentStressPage } from './ContentStressPage';
import { AUTHORED_COPY, STRESS_STATE } from './stressMatrix';

type MessageNode = string | { [key: string]: MessageNode };

const SERVED_NAMESPACES: Record<string, MessageNode> = {
    common: messages.common,
    errors: messages.errors
};

/*
 * `next-intl/server` reads the request context Next.js builds per render; jsdom has none. The fixture
 * must run on the namespaces every fork keeps, so the stand-in serves `common` and `errors` and
 * throws on any other one: a call site that asks for the start page's namespace fails this test, as it
 * would fail a fork that removed that namespace (there at the type check, here at run time).
 */
vi.mock('next-intl/server', () => ({
    getTranslations: ({ namespace }: { namespace: string }) => {
        const section = SERVED_NAMESPACES[namespace];
        if (section === undefined) {
            throw new Error(`namespace "${namespace}" is not served to the content-stress fixture`);
        }
        return Promise.resolve((key: string): string => {
            const message = key
                .split('.')
                .reduce<MessageNode | undefined>(
                    (node, part) => (typeof node === 'object' ? node[part] : undefined),
                    section
                );
            return typeof message === 'string' ? message : key;
        });
    }
}));

describe('content stress page', () => {
    it('renders its authored copy without the start page namespace', async () => {
        renderWithProviders(await ContentStressPage());

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(AUTHORED_COPY.heading);
        const typicalProse = screen
            .getAllByRole('article')
            .find(
                (article) =>
                    article.getAttribute('data-stress-component') === 'Prose' &&
                    article.getAttribute('data-stress-state') === STRESS_STATE.TYPICAL
            );
        if (typicalProse === undefined) {
            throw new Error('the Prose case in the typical state is not rendered');
        }
        const prose = within(typicalProse);
        expect(prose.getByRole('heading', { level: 3 })).toHaveTextContent(AUTHORED_COPY.heading);
        expect(prose.getByText(AUTHORED_COPY.text)).toBeInTheDocument();
    });
});
