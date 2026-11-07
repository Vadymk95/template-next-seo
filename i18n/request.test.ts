import { locale as rootLocale } from 'next/root-params';
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
 * `next/root-params` is swapped by Next's compiler inside a request and throws outside one, so the
 * getter is a mock here and every test says what the request carried.
 *
 * `hasLocale` keeps its real behaviour and is only observed: with the single declared locale the
 * result of a missed `await` on the root locale is the same as the right one (the default is the
 * only locale), so what was handed to the validation is the one place it shows.
 */
vi.mock('next-intl/server', () => ({
    getRequestConfig: (createRequestConfig: unknown): unknown => createRequestConfig
}));

vi.mock('next/root-params', () => ({ locale: vi.fn() }));

vi.mock('next-intl', async (importOriginal) => {
    const actual = await importOriginal<{ hasLocale: typeof hasLocale }>();
    return { ...actual, hasLocale: vi.fn(actual.hasLocale) };
});

interface ResolvedConfig {
    locale: string;
    messages: Record<string, unknown>;
}

/*
 * The declared parameters still list next-intl's deprecated `requestLocale`, which this config no
 * longer reads. At runtime next-intl hands over the explicit `locale` override (when a caller passed
 * one) and a lazy `requestLocale` that nothing touches, so a call with `locale` alone is the real one.
 */
const resolveConfig = requestConfig as unknown as (params: {
    locale?: string;
}) => Promise<ResolvedConfig>;

describe('i18n request config', () => {
    it('serves the locale of the request with its messages', async () => {
        vi.mocked(rootLocale).mockResolvedValue('en');

        const config = await resolveConfig({});

        expect(rootLocale).toHaveBeenCalledOnce();
        expect(config.locale).toBe('en');
        expect(config.messages).toEqual(messages);
    });

    it('falls back to the default locale and its messages for a locale routing does not declare', async () => {
        vi.mocked(rootLocale).mockResolvedValue('fr');

        const config = await resolveConfig({});

        expect(config.locale).toBe(routing.defaultLocale);
        expect(config.messages).toEqual(messages);
    });

    it('falls back to the default locale when the request carries no locale segment', async () => {
        vi.mocked(rootLocale).mockResolvedValue(undefined);

        const config = await resolveConfig({});

        expect(config.locale).toBe(routing.defaultLocale);
        expect(config.messages).toEqual(messages);
    });

    it('does not accept a path-like value as a locale', async () => {
        vi.mocked(rootLocale).mockResolvedValue('../routing');

        const config = await resolveConfig({});

        expect(config.locale).toBe(routing.defaultLocale);
        expect(config.messages).toEqual(messages);
    });

    it('validates the settled locale string against the declared locales, never the pending promise', async () => {
        vi.mocked(rootLocale).mockResolvedValue('fr');

        await resolveConfig({});

        expect(hasLocale).toHaveBeenLastCalledWith(routing.locales, 'fr');
    });

    // A Server Action or a metadata image cannot read root params: Next throws there. A caller that
    // knows its locale passes it, and the config must take that and leave the request alone.
    it('uses the locale a caller passes and never reads the request', async () => {
        vi.mocked(rootLocale).mockRejectedValue(new Error('root params are not readable here'));

        const config = await resolveConfig({ locale: 'en' });

        expect(rootLocale).not.toHaveBeenCalled();
        expect(hasLocale).toHaveBeenLastCalledWith(routing.locales, 'en');
        expect(config.locale).toBe('en');
        expect(config.messages).toEqual(messages);
    });

    it('validates a locale a caller passes the same way', async () => {
        const config = await resolveConfig({ locale: 'fr' });

        expect(hasLocale).toHaveBeenLastCalledWith(routing.locales, 'fr');
        expect(config.locale).toBe(routing.defaultLocale);
        expect(config.messages).toEqual(messages);
    });
});
