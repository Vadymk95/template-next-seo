import { afterEach, describe, expect, it } from 'vitest';

import { getAppBaseUrl, getPublicEnv } from './env';

describe('getPublicEnv', () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
            process.env.NEXT_PUBLIC_APP_URL = original;
        }
    });

    it('defaults when NEXT_PUBLIC_APP_URL is unset', () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        expect(getPublicEnv().NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    });

    it('accepts a valid explicit URL', () => {
        process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
        expect(getPublicEnv().NEXT_PUBLIC_APP_URL).toBe('https://example.com');
    });
});

describe('getAppBaseUrl', () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
            process.env.NEXT_PUBLIC_APP_URL = original;
        }
    });

    it('strips a trailing slash from the configured base URL', () => {
        process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/';
        expect(getAppBaseUrl()).toBe('https://example.com');
    });
});
