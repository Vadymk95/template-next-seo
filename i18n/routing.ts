import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['en'] as const,
    defaultLocale: 'en',
    localePrefix: 'always'
});
