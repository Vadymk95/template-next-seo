import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';

// Load real translation files to avoid duplication (Vitest resolves JSON via @/)
import commonTranslations from '@/public/locales/en/common.json';
import errorsTranslations from '@/public/locales/en/errors.json';
import homeTranslations from '@/public/locales/en/home.json';
import i18n from '@/shared/lib/i18n';
import { ALL_NAMESPACES, DEFAULT_LANGUAGE, DEFAULT_NAMESPACE } from '@/shared/lib/i18n/constants';
// Map namespaces to their translation objects
const translationMap = {
    common: commonTranslations,
    errors: errorsTranslations,
    home: homeTranslations
} as const;

// Ensure i18next is initialized for tests
if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
        lng: DEFAULT_LANGUAGE,
        fallbackLng: DEFAULT_LANGUAGE,
        ns: ALL_NAMESPACES,
        defaultNS: DEFAULT_NAMESPACE,
        resources: {
            [DEFAULT_LANGUAGE]: Object.fromEntries(
                ALL_NAMESPACES.map((ns) => [ns, translationMap[ns]])
            )
        },
        interpolation: {
            escapeValue: false
        },
        react: {
            useSuspense: false
        }
    });
}

interface ProvidersProps {
    children: ReactNode;
}

export const renderWithProviders = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
    const Wrapper = ({ children }: ProvidersProps) => (
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    );

    return render(ui, { wrapper: Wrapper, ...options });
};
