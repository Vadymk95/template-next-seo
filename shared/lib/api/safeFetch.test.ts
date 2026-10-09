import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { safeFetch, safeParseResponse, SchemaValidationError } from './safeFetch';

const URL = 'https://safe-fetch.invalid/probe';
const Schema = z.object({ value: z.number() });

// A constructed `Response` has an empty `url`; a real network response carries the final one.
const respond = (body: BodyInit | null, init: ResponseInit = {}, url = URL): Response => {
    const response = new Response(body, init);
    Object.defineProperty(response, 'url', { value: url });
    return response;
};

const json = (body: unknown, init: ResponseInit = {}, url = URL): Response =>
    respond(JSON.stringify(body), init, url);

const catchError = (run: () => Promise<unknown>): Promise<unknown> =>
    run().then(
        () => {
            throw new Error('expected the call to reject');
        },
        (caught: unknown) => caught
    );

describe('SchemaValidationError', () => {
    it('is an Error that names itself and carries the url and the zod issues', () => {
        const parsed = Schema.safeParse({ value: 'nope' });
        if (parsed.success) {
            throw new Error('fixture must not satisfy the schema');
        }

        const error = new SchemaValidationError(URL, parsed.error.issues);

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('SchemaValidationError');
        expect(error.message).toBe(`Schema validation failed for ${URL}`);
        expect(error.url).toBe(URL);
        expect(error.issues).toBe(parsed.error.issues);
    });
});

describe('safeParseResponse', () => {
    it('returns the data parsed by the schema, not the raw body', async () => {
        const result = await safeParseResponse(json({ value: 42, extra: 'dropped' }), Schema);

        expect(result).toEqual({ value: 42 });
    });

    it('throws SchemaValidationError with the response url and the failing path', async () => {
        const error = await catchError(() =>
            safeParseResponse(json({ value: 'not-a-number' }), Schema)
        );

        expect(error).toBeInstanceOf(SchemaValidationError);
        expect((error as SchemaValidationError).url).toBe(URL);
        expect((error as SchemaValidationError).issues.map((issue) => issue.path)).toEqual([
            ['value']
        ]);
    });

    it('reports an unknown url when the response carries none', async () => {
        const error = await catchError(() => safeParseResponse(json({}, {}, ''), Schema));

        expect((error as SchemaValidationError).url).toBe('<unknown>');
        expect((error as SchemaValidationError).message).toBe(
            'Schema validation failed for <unknown>'
        );
    });

    it('lets a body that is not JSON surface as the JSON error, not as a schema error', async () => {
        const error = await catchError(() =>
            safeParseResponse(respond('<html>oops</html>'), Schema)
        );

        expect(error).toBeInstanceOf(SyntaxError);
        expect(error).not.toBeInstanceOf(SchemaValidationError);
    });

    it('does not look at the status: a non-2xx body that matches the schema is parsed', async () => {
        const result = await safeParseResponse(json({ value: 7 }, { status: 422 }), Schema);

        expect(result).toEqual({ value: 7 });
    });
});

describe('safeFetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    afterEach(() => {
        fetchSpy.mockReset();
    });

    it('returns the parsed data when the response is 2xx and matches the schema', async () => {
        fetchSpy.mockResolvedValue(json({ value: 42, extra: 'dropped' }));

        await expect(safeFetch(URL, Schema)).resolves.toEqual({ value: 42 });
    });

    it('forwards the url and the init options to fetch untouched, once', async () => {
        fetchSpy.mockResolvedValue(json({ value: 1 }));
        const init: RequestInit = {
            method: 'POST',
            cache: 'no-store',
            headers: { 'x-probe': '1' }
        };

        await safeFetch(URL, Schema, init);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith(URL, init);
    });

    it('throws on a 4xx naming the url and the status, requests once and never reads the body', async () => {
        // The body is valid for the schema on purpose: only the status check can reject this.
        const response = json({ value: 1 }, { status: 404 });
        const readBody = vi.spyOn(response, 'json');
        fetchSpy.mockResolvedValue(response);

        const error = await catchError(() => safeFetch(URL, Schema));

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(SchemaValidationError);
        expect((error as Error).message).toBe(`Request to ${URL} failed with status 404`);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(readBody).not.toHaveBeenCalled();
    });

    it('throws the same way on a 5xx, with that status in the message', async () => {
        fetchSpy.mockResolvedValue(json({}, { status: 503 }));

        const error = await catchError(() => safeFetch(URL, Schema));

        expect((error as Error).message).toBe(`Request to ${URL} failed with status 503`);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws SchemaValidationError when a 2xx body does not match the schema', async () => {
        fetchSpy.mockResolvedValue(json({ value: 'not-a-number' }));

        const error = await catchError(() => safeFetch(URL, Schema));

        expect(error).toBeInstanceOf(SchemaValidationError);
        expect((error as SchemaValidationError).url).toBe(URL);
        expect((error as SchemaValidationError).issues.length).toBeGreaterThan(0);
    });

    it('rethrows the network failure from fetch itself, unchanged', async () => {
        const failure = new TypeError('fetch failed');
        fetchSpy.mockRejectedValue(failure);

        const error = await catchError(() => safeFetch(URL, Schema));

        expect(error).toBe(failure);
    });
});
