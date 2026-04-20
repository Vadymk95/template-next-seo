import { notFound } from 'next/navigation';
import { hasLocale, type Locale } from 'next-intl';

import { routing } from './routing';

export const requireLocale = (locale: string): Locale => {
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }
    return locale;
};
