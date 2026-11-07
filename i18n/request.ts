import { locale as rootLocale } from 'next/root-params';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

export default getRequestConfig(async ({ locale: explicitLocale }) => {
    // Next throws when a Server Action or a metadata image reads root params, so a caller that knows
    // its locale passes it (`getTranslations({ locale })`) and the request is left alone.
    const requested = explicitLocale ?? (await rootLocale());
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

    const messages = (
        (await import(`@/messages/${locale}.json`)) as { default: Record<string, unknown> }
    ).default;

    return {
        locale,
        messages
    };
});
