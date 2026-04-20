import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';

import { exampleFormAction } from './example-form';

vi.mock('next-intl/server', () => {
    const readPath = (source: unknown, path: string): string => {
        const value = path.split('.').reduce<unknown>((acc, key) => {
            if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
                return (acc as Record<string, unknown>)[key];
            }
            return undefined;
        }, source);
        return typeof value === 'string' ? value : path;
    };

    return {
        getTranslations: async (namespace: string) => {
            return (key: string) => readPath(messages, `${namespace}.${key}`);
        }
    };
});

describe('exampleFormAction', () => {
    beforeEach(() => {
        vi.useFakeTimers();
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
        const formData = new FormData();
        formData.set('name', 'Ada');
        formData.set('email', 'ada@example.com');

        const pending = exampleFormAction(formData);
        await vi.advanceTimersByTimeAsync(1000);
        const result = await pending;

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.message).toBe(messages.common.form.submittedSuccessfully);
            expect(result.data).toEqual({ name: 'Ada', email: 'ada@example.com' });
        }
    });
});
