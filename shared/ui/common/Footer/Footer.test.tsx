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

import { Footer } from './index';

describe('Footer', () => {
    it('gives every footer link the touch height', () => {
        // Measured at roughly 39x20 before this: below even WCAG 2.5.8's 24px minimum.
        renderWithProviders(<Footer />);

        for (const link of screen.getAllByRole('link')) {
            expect(link.className, `${link.textContent ?? '?'} lost its touch row`).toContain(
                'min-h-11'
            );
            expect(link.className).toContain('inline-flex');
        }
    });
});
