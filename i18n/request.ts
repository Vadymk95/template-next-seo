import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

// eslint-disable-next-line @typescript-eslint/no-deprecated -- the request-config hook of the current next-intl routing; moving to next/root-params is a routing migration, not a lint fix
export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

    const messages = (
        (await import(`@/messages/${locale}.json`)) as { default: Record<string, unknown> }
    ).default;

    return {
        locale,
        messages
    };
});
