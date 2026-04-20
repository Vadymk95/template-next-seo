# DICTIONARY — template-next-seo

| Term | Meaning |
| --- | --- |
| **RSC** | React Server Component — default in App Router without `'use client'`. |
| **FOUC (i18n)** | Flash of untranslated content; mitigated via `html.i18n-loading` / `html.i18n-ready` in `globals.css`. |
| **Server Action** | Server-side function invoked from a form or client component via `action=` or `useActionState`; marked with `'use server'`. |
| **ISR** | Incremental Static Regeneration — `export const revalidate = N` (seconds) on a route. Used on `/` (1h) and `/example-form` (30m). |
| **Nonce CSP** | Per-request CSP nonce injected by `proxy.ts` for scripts and inline styles; enables `'strict-dynamic'`. |
| **Rate limit (two-tier)** | In-memory core (`shared/lib/rateLimitCore.ts`) per instance; optional Upstash Redis (`shared/lib/upstashRateLimit.ts`) for distributed deployments. |
