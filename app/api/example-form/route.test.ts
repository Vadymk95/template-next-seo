import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/shared/lib/logger';

import { GET, POST } from './route';

vi.mock('@/shared/lib/logger', () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

const ORIGIN = 'http://localhost:3000';
const NOW = '2026-01-02T03:04:05.000Z';

const post = (body: string, headers: Record<string, string> = { origin: ORIGIN }): NextRequest =>
    new NextRequest(`${ORIGIN}/api/example-form`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body
    });

describe('/api/example-form', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NEXT_PUBLIC_APP_URL', ORIGIN);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(NOW));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    describe('GET', () => {
        it('returns 200 with the greeting, the current time and a short shared cache', async () => {
            const res = await GET();

            expect(res.status).toBe(200);
            expect(res.headers.get('Cache-Control')).toBe(
                'public, s-maxage=60, stale-while-revalidate=300'
            );
            expect(await res.json()).toEqual({ message: 'Hello from API route', timestamp: NOW });
        });

        it('returns 500 and logs the error instance when building the response throws', async () => {
            const failure = new Error('boom');
            vi.spyOn(NextResponse, 'json').mockImplementationOnce(() => {
                throw failure;
            });

            const res = await GET();

            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({ error: 'Internal server error' });
            expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
                '[example-form-api] GET failed',
                failure
            );
        });

        it('wraps a non-Error throw in an Error before logging it', async () => {
            vi.spyOn(NextResponse, 'json').mockImplementationOnce(() => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error -- the case under test is a thrown non-Error
                throw 'plain failure';
            });

            const res = await GET();

            expect(res.status).toBe(500);
            const logged = vi.mocked(logger.error).mock.calls[0]?.[1];
            expect(logged).toBeInstanceOf(Error);
            expect(logged).toHaveProperty('message', 'plain failure');
        });
    });

    describe('POST', () => {
        it('returns 201 echoing the body, marked processed, and never cacheable', async () => {
            const payload = { name: 'Ada Lovelace', email: 'ada@example.com' };

            const res = await POST(post(JSON.stringify(payload)));

            expect(res.status).toBe(201);
            expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
            expect(await res.json()).toEqual({
                received: payload,
                processed: true,
                timestamp: NOW
            });
            expect(vi.mocked(logger.error)).not.toHaveBeenCalled();
        });

        it.each(['null', '0', 'false', '""', '42', '"text"'])(
            'returns 400 when the JSON body is the non-object %s',
            async (raw) => {
                const res = await POST(post(raw));

                expect(res.status).toBe(400);
                expect(await res.json()).toEqual({ error: 'Invalid request body' });
                expect(vi.mocked(logger.error)).not.toHaveBeenCalled();
            }
        );

        it('returns 403 without reading the body when Origin is missing', async () => {
            const res = await POST(post('{"name":"Ada"}', {}));

            expect(res.status).toBe(403);
            expect(res.body).toBeNull();
        });

        it('returns 403 for a cross-site Origin', async () => {
            const res = await POST(post('{"name":"Ada"}', { origin: 'https://evil.example' }));

            expect(res.status).toBe(403);
            expect(res.body).toBeNull();
        });

        it('returns 500 and logs the parse failure when the body is not JSON', async () => {
            const res = await POST(post('{not json'));

            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({ error: 'Internal server error' });
            expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);
            const [message, logged] = vi.mocked(logger.error).mock.calls[0] ?? [];
            expect(message).toBe('[example-form-api] POST failed');
            expect(logged).toBeInstanceOf(Error);
        });

        it('wraps a non-Error rejection from the body reader in an Error before logging it', async () => {
            const req = post('{}');
            vi.spyOn(req, 'json').mockRejectedValueOnce('plain failure');

            const res = await POST(req);

            expect(res.status).toBe(500);
            const logged = vi.mocked(logger.error).mock.calls[0]?.[1];
            expect(logged).toBeInstanceOf(Error);
            expect(logged).toHaveProperty('message', 'plain failure');
        });
    });
});
