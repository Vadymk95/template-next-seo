import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import { routing } from '@/i18n/routing';
import messages from '@/messages/en.json';

interface ProvidersProps {
    children: ReactNode;
}

export const renderWithProviders = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
    const Wrapper = ({ children }: ProvidersProps) => (
        <NextIntlClientProvider locale={routing.defaultLocale} messages={messages}>
            {children}
        </NextIntlClientProvider>
    );

    return render(ui, { wrapper: Wrapper, ...options });
};
