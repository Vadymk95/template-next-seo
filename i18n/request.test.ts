import { hasLocale } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';

import requestConfig from './request';
import { routing } from './routing';

/*
 * Outside a React Server Components render `next-intl/server` resolves to a client stub whose
 * `getRequestConfig` throws. The real one returns the callback it is given, so this identity
 * stand-in runs the module's own locale resolution unchanged.
 *
 * `hasLocale` keeps its real behaviour and is only observed: with the single declared locale the
 * result of a missed `await` on the request locale is the same as the right one (the default is
 * the only locale), so what was handed to the validation is the one place it shows.
 */
vi.mock('next-intl/server', () => ({
    getRequestConfig: (createRequestConfig: unknown): unknown => createRequestConfig
}));

vi.mock('next-intl', async (importOriginal) => {
    const actual = await importOriginal<{ hasLocale: typeof hasLocale }>();
    return { ...actual, hasLocale: vi.fn(actual.hasLocale) };
});

describe('i18n request config', () => {
    it('serves the requested locale with its messages', async () => {
        const config = await requestConfig({ requestLocale: Promise.resolve('en') });

        expect(config.locale).toBe('en');
        expect(config.messages).toEqual(messages);
    });

    it('falls back to the default locale and its messages for a locale routing does not declare', async () => {
        const config = await requestConfig({ requestLocale: Promise.resolve('fr') });

        expect(config.locale).toBe(routing.defaultLocale);
        expect(config.messages).toEqual(messages);
    });

    it('falls back to the default locale when the request carries no locale segment', async () => {
        const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });

        expect(config.locale).toBe(routing.defaultLocale);
        expect(config.messages).toEqual(messages);
    });

    it('does not accept a path-like value as a locale', async () => {
        const config = await requestConfig({ requestLocale: Promise.resolve('../routing') });

        expect(config.locale).toBe(routing.defaultLocale);
        expect(config.messages).toEqual(messages);
    });

    it('validates the settled locale string against the declared locales, never the pending promise', async () => {
        await requestConfig({ requestLocale: Promise.resolve('fr') });

        expect(hasLocale).toHaveBeenLastCalledWith(routing.locales, 'fr');
    });
});
