import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger';

/* Silences every console method the logger could write through and returns the spies by name. */
const spyOnConsole = () => ({
    log: vi.spyOn(console, 'log').mockImplementation(() => undefined),
    debug: vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    info: vi.spyOn(console, 'info').mockImplementation(() => undefined),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    error: vi.spyOn(console, 'error').mockImplementation(() => undefined)
});

/* The names of the console methods that received at least one call. */
const writtenThrough = (spies: ReturnType<typeof spyOnConsole>): string[] =>
    Object.entries(spies)
        .filter(([, spy]) => spy.mock.calls.length > 0)
        .map(([method]) => method);

type RemoveConsole = boolean | { exclude?: string[] } | undefined;

/* `compiler.removeConsole`: `true` strips every console method, an object strips all but `exclude`. */
const isStripped = (method: string, removeConsole: RemoveConsole): boolean =>
    removeConsole === true ||
    (typeof removeConsole === 'object' && !(removeConsole.exclude ?? []).includes(method));

/* The option is evaluated when `next.config.ts` loads, so each environment needs a fresh import. */
const loadRemoveConsole = async (nodeEnv: 'production' | 'development'): Promise<RemoveConsole> => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.resetModules();
    const { default: nextConfig } = await import('@/next.config');
    return nextConfig.compiler?.removeConsole;
};

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

const productionWrites: [level: 'info' | 'warn' | 'error', write: () => void][] = [
    [
        'info',
        () => {
            logger.info('hello', { requestId: 'r1' });
        }
    ],
    [
        'warn',
        () => {
            logger.warn('hello', { requestId: 'r1' });
        }
    ],
    [
        'error',
        () => {
            logger.error('hello', undefined, { requestId: 'r1' });
        }
    ]
];

describe('logger', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('outside production', () => {
        it('writes info through console.info with a level-tagged prefix', () => {
            const spies = spyOnConsole();

            logger.info('hello', { requestId: 'r1' });

            expect(writtenThrough(spies)).toEqual(['info']);
            const [prefix, message, context] = spies.info.mock.calls[0] ?? [];
            expect(String(prefix)).toContain('[INFO]');
            expect(message).toBe('hello');
            expect(context).toEqual({ requestId: 'r1' });
        });

        it('writes a warning through console.warn in the same format', () => {
            const spies = spyOnConsole();

            logger.warn('slow response', { ms: 900 });

            expect(writtenThrough(spies)).toEqual(['warn']);
            const [prefix, message, context] = spies.warn.mock.calls[0] ?? [];
            expect(String(prefix)).toContain('[WARN]');
            expect(message).toBe('slow response');
            expect(context).toEqual({ ms: 900 });
        });

        it('routes errors to console.error and keeps the Error object', () => {
            const spies = spyOnConsole();
            const failure = new Error('boom');

            logger.error('request failed', failure, { endpoint: '/api/x' });

            expect(writtenThrough(spies)).toEqual(['error']);
            expect(spies.error.mock.calls[0]).toContain(failure);
        });

        it('routes an error logged without an Error object to console.error', () => {
            const spies = spyOnConsole();

            logger.error('request failed');

            expect(writtenThrough(spies)).toEqual(['error']);
            const [prefix, message, context] = spies.error.mock.calls[0] ?? [];
            expect(String(prefix)).toContain('[ERROR]');
            expect(message).toBe('request failed');
            expect(context).toBe('');
        });

        it('prints debug through console.log in development', () => {
            vi.stubEnv('NODE_ENV', 'development');
            const spies = spyOnConsole();

            logger.debug('noisy internals', { step: 2 });

            expect(writtenThrough(spies)).toEqual(['log']);
            const [prefix, message, context] = spies.log.mock.calls[0] ?? [];
            expect(String(prefix)).toContain('[DEBUG]');
            expect(message).toBe('noisy internals');
            expect(context).toEqual({ step: 2 });
        });
    });

    it.each(['test', 'production'])('suppresses debug when NODE_ENV is %s', (nodeEnv) => {
        vi.stubEnv('NODE_ENV', nodeEnv);
        const spies = spyOnConsole();

        logger.debug('noisy internals');

        expect(writtenThrough(spies)).toEqual([]);
    });

    describe('in production', () => {
        beforeEach(() => {
            vi.stubEnv('NODE_ENV', 'production');
        });

        describe('on the server', () => {
            beforeEach(() => {
                // Vitest runs under jsdom, where `window` exists; the server has none.
                vi.stubGlobal('window', undefined);
            });

            it.each(productionWrites)(
                'writes %s as one JSON line through the console method of the same name',
                (level, write) => {
                    const spies = spyOnConsole();

                    write();

                    expect(writtenThrough(spies)).toEqual([level]);
                    expect(spies[level].mock.calls[0]).toHaveLength(1);
                    expect(JSON.parse(String(spies[level].mock.calls[0]?.[0]))).toEqual({
                        level,
                        message: 'hello',
                        timestamp: expect.any(String),
                        context: { requestId: 'r1' }
                    });
                }
            );

            it('emits a single JSON line with serialized error', () => {
                const spies = spyOnConsole();

                logger.error('request failed', new Error('boom'));

                expect(writtenThrough(spies)).toEqual(['error']);
                expect(spies.error).toHaveBeenCalledTimes(1);
                const entry = JSON.parse(String(spies.error.mock.calls[0]?.[0])) as {
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
        });

        describe('in a browser', () => {
            beforeEach(() => {
                vi.stubGlobal('window', {});
            });

            it('drops info, which a production build used to strip there', () => {
                const spies = spyOnConsole();

                logger.info('hello', { requestId: 'r1' });

                expect(writtenThrough(spies)).toEqual([]);
            });

            it.each(productionWrites.filter(([level]) => level !== 'info'))(
                'still writes %s as one JSON line',
                (level, write) => {
                    const spies = spyOnConsole();

                    write();

                    expect(writtenThrough(spies)).toEqual([level]);
                    expect(JSON.parse(String(spies[level].mock.calls[0]?.[0]))).toMatchObject({
                        level,
                        message: 'hello'
                    });
                }
            );
        });
    });

    describe('against the compiler.removeConsole option of next.config.ts', () => {
        it('is not stripped from a production build', async () => {
            const removeConsole = await loadRemoveConsole('production');
            // Info is written on the server only, so the server is the case the list has to cover.
            vi.stubGlobal('window', undefined);
            const spies = spyOnConsole();

            for (const level of LEVELS) {
                logger[level]('probe');
            }

            const used = writtenThrough(spies);
            const stripped = used.filter((method) => isStripped(method, removeConsole));
            expect(used, 'the logger wrote nothing in production').not.toEqual([]);
            expect(
                stripped,
                `a production build strips console.${stripped.join(', console.')}, which the logger writes through`
            ).toEqual([]);
        });

        it('is kept whole in development', async () => {
            expect(await loadRemoveConsole('development')).toBeFalsy();
        });
    });
});
