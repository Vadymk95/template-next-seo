import { screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

/*
 * `SmartLink` wraps next-intl's client navigation, which needs `next/navigation` — not available in
 * jsdom. The subject here is the CLASS CONTRACT this component passes down, not the routing, so the link
 * is replaced with a plain anchor that forwards its props. Routing is covered by `e2e/nav-ux.spec.ts`.
 */
vi.mock('@/shared/ui/common/SmartLink', () => ({
    SmartLink: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>): ReactElement => (
        <a {...props}>{children}</a>
    )
}));

import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import { Header } from './index';

/**
 * jsdom cannot measure a box, so the real guard is `e2e/layout-geometry.spec.ts`, which measures the
 * header on every route at five widths. What these pin is the class contract that guard depends on, so a
 * regression fails in a second instead of in a full e2e run.
 */
describe('Header', () => {
    it('gives every chrome link the touch height and the display mode that applies it', () => {
        renderWithProviders(<Header />);

        for (const link of screen.getAllByRole('link')) {
            expect(link.className, `${link.textContent ?? '?'} lost its touch row`).toContain(
                'min-h-11'
            );
            // `min-h-11` is ignored on an inline box; the display mode is half the guard.
            expect(link.className).toContain('inline-flex');
        }
    });

    it('lets the chrome row wrap, because a row that cannot wrap can only overflow', () => {
        const { container } = renderWithProviders(<Header />);
        const row = container.querySelector('header > div');

        expect(row).toHaveClass('flex-wrap');
        // A fixed height would clip the second line the moment the row wraps.
        expect(row).toHaveClass('min-h-16');
    });

    it('truncates the brand on an inner element, not on the flex container', () => {
        const { container } = renderWithProviders(<Header />);
        const brand = container.querySelector('header a');

        expect(brand?.className).toContain('min-w-0');
        expect(brand?.className).not.toContain('truncate');
        expect(brand?.firstElementChild).toHaveClass('truncate');
    });
});
