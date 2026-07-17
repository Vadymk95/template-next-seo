import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger';

describe('logger', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('logs info with a level-tagged prefix outside production', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        logger.info('hello', { requestId: 'r1' });

        expect(logSpy).toHaveBeenCalledTimes(1);
        const [prefix, message, context] = logSpy.mock.calls[0] ?? [];
        expect(String(prefix)).toContain('[INFO]');
        expect(message).toBe('hello');
        expect(context).toEqual({ requestId: 'r1' });
    });

    it('routes errors to console.error and keeps the Error object', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const failure = new Error('boom');

        logger.error('request failed', failure, { endpoint: '/api/x' });

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0]).toContain(failure);
    });

    it('emits a single JSON line with serialized error in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        logger.error('request failed', new Error('boom'));

        expect(logSpy).toHaveBeenCalledTimes(1);
        const entry = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
            level: string;
            message: string;
            timestamp: string;
            error?: { name: string; message: string };
        };
        expect(entry.level).toBe('error');
        expect(entry.message).toBe('request failed');
        expect(entry.error?.message).toBe('boom');
        expect(Date.parse(entry.timestamp)).not.toBeNaN();
    });

    it('suppresses debug outside development', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        logger.debug('noisy internals');

        expect(logSpy).not.toHaveBeenCalled();
    });
});
