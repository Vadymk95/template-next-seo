import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routing } from '@/i18n/routing';
import messages from '@/messages/en.json';

import { exampleFormAction } from './example-form';

const { getTranslations } = vi.hoisted(() => ({ getTranslations: vi.fn() }));

vi.mock('next-intl/server', () => ({ getTranslations }));

// Two declared locales, so an action that ignores the sent locale shows.
vi.mock('@/i18n/routing', () => ({
    routing: { locales: ['en', 'de'], defaultLocale: 'en' }
}));

const readPath = (source: unknown, path: string): string => {
    const value = path.split('.').reduce<unknown>((acc, key) => {
        if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, source);
    return typeof value === 'string' ? value : path;
};

const validForm = (locale?: string | File): FormData => {
    const formData = new FormData();
    formData.set('name', 'Ada');
    formData.set('email', 'ada@example.com');
    if (locale !== undefined) formData.set('locale', locale);
    return formData;
};

describe('exampleFormAction', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        getTranslations.mockImplementation(({ namespace }: { namespace: string }) =>
            Promise.resolve((key: string) => readPath(messages, `${namespace}.${key}`))
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns field errors for invalid input', async () => {
        const formData = new FormData();
        formData.set('name', '');
        formData.set('email', 'not-an-email');

        const result = await exampleFormAction(formData);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.fieldErrors).toBeDefined();
            expect(result.fieldErrors?.email).toBeDefined();
        }
    });

    it('returns success after simulated processing when input is valid', async () => {
        const pending = exampleFormAction(validForm('en'));
        await vi.advanceTimersByTimeAsync(1000);
        const result = await pending;

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.message).toBe(messages.common.form.submittedSuccessfully);
            expect(result.data).toEqual({ name: 'Ada', email: 'ada@example.com' });
        }
    });

    // A Server Action cannot read the locale from the request (`next/root-params` throws there), so
    // it translates with the locale the form sent and says so to next-intl explicitly.
    it.each(['en', 'de'])('translates with the locale the form sent: %s', async (locale) => {
        const pending = exampleFormAction(validForm(locale));
        await vi.advanceTimersByTimeAsync(1000);
        await pending;

        expect(getTranslations).toHaveBeenCalledWith({ locale, namespace: 'common.form' });
        expect(getTranslations).toHaveBeenCalledWith({ locale, namespace: 'errors.page' });
    });

    // The locale is client input: only a value the routing declares is used.
    it.each([
        ['absent', undefined],
        ['empty', ''],
        ['undeclared', 'fr'],
        ['path-like', '../routing'],
        ['not text', new File([], 'locale.txt')]
    ])('falls back to the default locale when the sent locale is %s', async (_case, sent) => {
        const pending = exampleFormAction(validForm(sent));
        await vi.advanceTimersByTimeAsync(1000);
        await pending;

        expect(getTranslations).toHaveBeenCalledTimes(2);
        for (const [options] of getTranslations.mock.calls) {
            expect(options).toMatchObject({ locale: routing.defaultLocale });
        }
    });
});
