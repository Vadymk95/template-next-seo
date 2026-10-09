import { describe, expect, it } from 'vitest';

import { exampleFormSchema } from './schema';

const valid = { name: 'Ada Lovelace', email: 'ada@example.com' };

describe('exampleFormSchema', () => {
    it('accepts a name and a well-formed email', () => {
        expect(exampleFormSchema.safeParse(valid)).toEqual({ success: true, data: valid });
    });

    it('strips fields the form does not define', () => {
        const result = exampleFormSchema.safeParse({ ...valid, role: 'admin' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(valid);
    });

    it('rejects an empty name with the required message', () => {
        const result = exampleFormSchema.safeParse({ ...valid, name: '' });

        expect(result.success).toBe(false);
        expect(result.error?.issues).toHaveLength(1);
        expect(result.error?.issues[0]).toMatchObject({
            path: ['name'],
            message: 'Name is required'
        });
    });

    it.each([1, 100])('accepts a name of %i characters, the inclusive bounds', (length) => {
        expect(exampleFormSchema.safeParse({ ...valid, name: 'a'.repeat(length) }).success).toBe(
            true
        );
    });

    it('rejects a name of 101 characters with the too-long message', () => {
        const result = exampleFormSchema.safeParse({ ...valid, name: 'a'.repeat(101) });

        expect(result.success).toBe(false);
        expect(result.error?.issues).toHaveLength(1);
        expect(result.error?.issues[0]).toMatchObject({
            path: ['name'],
            message: 'Name is too long'
        });
    });

    it.each(['', 'plain', 'ada@', '@example.com', 'ada@example', 'ada example@example.com'])(
        'rejects the malformed email %j with the format message',
        (email) => {
            const result = exampleFormSchema.safeParse({ ...valid, email });

            expect(result.success).toBe(false);
            expect(result.error?.issues).toHaveLength(1);
            expect(result.error?.issues[0]).toMatchObject({
                path: ['email'],
                message: 'Invalid email format'
            });
        }
    );

    it('rejects a missing name and a missing email as separate field errors', () => {
        const result = exampleFormSchema.safeParse({});

        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path)).toEqual([['name'], ['email']]);
    });

    it('rejects a non-string name and email', () => {
        const result = exampleFormSchema.safeParse({ name: 42, email: null });

        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path)).toEqual([['name'], ['email']]);
    });
});
