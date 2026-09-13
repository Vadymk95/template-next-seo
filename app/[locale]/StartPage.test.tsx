import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import messages from '@/messages/en.json';
import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import { StartPage } from './StartPage';

describe('StartPage', () => {
    it('renders the title as the only h1 and one heading per section', () => {
        renderWithProviders(<StartPage />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(messages.home.title);
        for (const title of [
            messages.home.inside.title,
            messages.home.flow.title,
            messages.home.agents.title,
            messages.home.reading.title,
            messages.home.steps.title
        ]) {
            expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
        }
    });

    it('names every agent command and the one file every tool reads', () => {
        renderWithProviders(<StartPage />);

        for (const command of ['/onboard', '/feat', '/test', '/review', '/docs']) {
            expect(screen.getByText(command)).toBeInTheDocument();
        }
        expect(screen.getByText('AGENTS.md')).toBeInTheDocument();
        expect(screen.getByText('npm run verify:iter')).toBeInTheDocument();
    });

    it('lists the four moments in order', () => {
        renderWithProviders(<StartPage />);

        const moments = screen
            .getAllByRole('heading', { level: 3 })
            .map((heading) => heading.textContent);
        expect(moments).toEqual([
            messages.home.flow.iterate.title,
            messages.home.flow.commit.title,
            messages.home.flow.push.title,
            messages.home.flow.ci.title
        ]);
    });
});
