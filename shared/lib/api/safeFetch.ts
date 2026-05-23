/**
 * Boundary validation wrapper for `fetch` + Zod schemas.
 *
 * Next.js 16 context — usable in every runtime:
 * - **React Server Components** (`await safeFetch(url, schema)` inside an RSC).
 * - **Server Actions** (`'use server'` files — validate upstream API responses
 *   before returning data to the client).
 * - **Route handlers** (`app/api/*\/route.ts` — validate outbound calls; for
 *   incoming `request.json()` payloads, prefer `Schema.safeParse(...)` directly).
 * - **Client Components** (`'use client'` islands — same call shape).
 *
 * The module avoids browser-only globals (`window`, `document`, `localStorage`)
 * so it runs unchanged in Node, the Edge runtime, and the browser. It assumes
 * only the `fetch` API + `Response` (both standard in every Next 16 runtime).
 *
 * Pair with the `ServerActionResultSchema` pattern in
 * `app/actions/example-form.ts` to give clients a runtime contract for Server
 * Action return shapes. See `.cursor/brain/DECISIONS.md` ADR
 * "Boundary validation via Zod safeFetch + Server Action output schemas".
 */

import type { z } from 'zod';

/**
 * Thrown when a `fetch` response cannot be parsed by the supplied Zod schema.
 *
 * Carries the originating `url` and the raw `issues` array from Zod's
 * `safeParse` failure so callers (and `logger.error`) can surface precise
 * boundary-mismatch diagnostics without re-running validation.
 */
export class SchemaValidationError extends Error {
    public readonly url: string;
    public readonly issues: readonly z.ZodIssue[];

    constructor(url: string, issues: readonly z.ZodIssue[]) {
        super(`Schema validation failed for ${url}`);
        this.name = 'SchemaValidationError';
        this.url = url;
        this.issues = issues;
    }
}

/**
 * Parse an existing `Response` against a Zod schema.
 *
 * Useful when the caller already has a `Response` in hand (e.g. an RSC that ran
 * `await fetch(url, { next: { revalidate: 60 } })` and wants to keep Next's
 * cache options inline) and only needs the validation step.
 *
 * Throws:
 * - `SchemaValidationError` if the body does not match `schema`.
 * - The original `Error` from `response.json()` if the body is not valid JSON.
 *
 * Does **not** check `response.ok` — caller decides whether non-2xx bodies
 * should still be parsed (some APIs return structured error envelopes).
 */
export async function safeParseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    const url = response.url || '<unknown>';
    const json: unknown = await response.json();
    const parsed = schema.safeParse(json);

    if (!parsed.success) {
        throw new SchemaValidationError(url, parsed.error.issues);
    }

    return parsed.data;
}

/**
 * Fetch a URL and validate the JSON body against a Zod schema.
 *
 * Throws:
 * - The original `TypeError` from `fetch` on network failure.
 * - `Error` with the status code on HTTP non-2xx (`!response.ok`).
 * - `SchemaValidationError` if the body does not match `schema`.
 *
 * Returns the parsed, typed data on success.
 *
 * Forwards `init` straight to `fetch`, so Next 16 caching hints
 * (`next: { revalidate, tags }`, `cache: 'no-store'`, etc.) work as documented.
 */
export async function safeFetch<T>(
    url: string,
    schema: z.ZodType<T>,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error(`Request to ${url} failed with status ${response.status}`);
    }

    return safeParseResponse(response, schema);
}
