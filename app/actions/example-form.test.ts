import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exampleFormAction } from './example-form';

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
            expect(result.message).toBe('Form submitted successfully');
            expect(result.data).toEqual({ name: 'Ada', email: 'ada@example.com' });
        }
    });
});
