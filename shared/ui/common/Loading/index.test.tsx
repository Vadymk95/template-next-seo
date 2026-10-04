import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';

import { Loading } from './index';

describe('Loading', () => {
    it('exposes the spinner as a status region so assistive technology announces it', () => {
        renderWithProviders(<Loading />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});
