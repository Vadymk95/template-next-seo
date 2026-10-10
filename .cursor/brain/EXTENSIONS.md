# Extensions — graduating template → real product

This file is the **single source of truth** for "what to add when forking this template into a real project". The template ships a security-hardened shell (proxy, two-layer CSP, rate limit, next-intl, a Zod boundary around `fetch`) and deliberately **no** backend client, auth, error monitoring, analytics vendor or CDN. TanStack Query was removed in an earlier cleanup because nothing used it, so the default data path is the server (Phase 1). Each phase below is a **recipe**: the trigger, the install command, where it plugs in, defaults with the reason for each value, the guard to add, the security note and what not to do. Skip phases you do not need.

Companion docs: `README.md` (commands, env vars, "Adding Languages", the restore playbook), `.cursor/brain/MAP.md` (where things are), `.cursor/brain/SKELETONS.md` (danger zones), `.cursor/brain/DECISIONS.md` (why the current shape), `.cursor/brain/VERIFICATION.md`, `SECURITY_REQUIREMENTS.md` (session, token and pre-deploy rules), `AGENTS.md` (invariants and the "Out of scope" list).

**Priority order when the fork becomes a real product** (the phases are the detail): real backend data on the server (Phase 1) → auth on session cookies (Phase 2) → error monitoring through the `logger` seam (Phase 3) → deployment hardening for the chosen host (Phase 7) → analytics only after a consent design (Phase 4) → i18n growth and images/CDN as content arrives (Phases 5-6).

**How to read the recipes.** Versions: the repo pins Next.js 16.4, React 19.3, next-intl 4.14 and Zod 4.6 (`package-lock.json`); a package version named below is the latest checked when this file was written, so run `npm view <package> version` before installing and re-read the linked doc if the major differs. Sources: Next.js docs are cited by file name from the vercel/next.js repository at the installed tag (for example `fetch.mdx`), TanStack by its guide name, Sentry by its manual-setup guide. A statement with no source is labelled **inference** or **opinion**; option tables are opinion unless a source is named. Several recipes touch files that `AGENTS.md` lists as ask-first (`next.config.ts`, `proxy.ts`, the CSP, the gate files): the recipe says so, and the edit is a security review, not a drive-by.

---

## Phase 1 — Real backend data

The template ships a Zod boundary around `fetch` (`shared/lib/api/safeFetch.ts`), a Server Action with a validated result schema (`app/actions/example-form.ts`) and no data-fetching library. `safeFetch` has no caller and no unit test in the tree yet: the first real use lands with its test (see 1b). Read `README.md` "Removed dependencies (restore playbook)" first; this phase is the architecture behind it.

### Choose one (where the call happens)

| Option                                  | Pros                                                                                | Cons                                                                                 | When to pick                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **Server Component `fetch`** (default)  | No client JS; HTTP-style cache with time and tag revalidation; secrets stay server  | Dynamic data makes the route dynamic; sequential awaits create waterfalls            | Anything rendered on the page                    |
| **Server Action + `safeFetch`**         | Typed contract; Next checks the request origin; works without client JS             | A public POST endpoint: needs its own auth check; built for mutations, not for reads | Form and button mutations                        |
| **Route Handler under `app/api`**       | Webhooks, third-party and mobile consumers; streaming                               | Passes the proxy rate limit and, for mutating methods, `requireSameOrigin`           | Anything a non-React client must call            |
| **Client island + TanStack Query** (1d) | Polling, infinite scroll, optimistic updates, refetch on focus, shared client cache | Second cache next to Next's; hydration plumbing; extra client JS                     | Interactive widgets only, never page-level reads |

### 1a. Upstream URL: server-only, not the public constant

**Trigger:** the first call to a backend that is not the app itself.
**Plug in:** `API_BASE_URL` in `shared/constants/index.ts` reads `NEXT_PUBLIC_API_URL`, and a `NEXT_PUBLIC_` value is inlined into the client bundle. That is fine for a public API and wrong for an internal host or anything credentialed. Put server-only variables in their own fork-created module (for example a `serverEnv.ts` beside `shared/lib/env.ts`) that starts with `import 'server-only'` and parses them with a Zod schema inside the accessor, so a missing value throws a named error on first use (at build for a prerendered route, otherwise on the first request). Do not add `server-only` to `shared/lib/env.ts` itself: `app/sitemap.ts`, `app/robots.ts` and `app/layout.tsx` import it, and `app/sitemap.test.ts` (through `app/sitemap.ts`) would start throwing (see the test note below). Declare the variable in `.env.example`.

**Testing a `server-only` module.** The package's default export throws ("This module cannot be imported from a Client Component module"); only the `react-server` export condition, which Next sets and Vitest does not, resolves to an empty file (`node_modules/server-only/package.json`). Every Vitest file that imports such a module, directly or through a getter, starts with `vi.mock('server-only', () => ({}))`, or mocks the whole module the way `proxy.test.ts` mocks `@/shared/lib/upstashRateLimit`.
**Do not:** build a URL from user input. Fix the origin in env, `encodeURIComponent` every path segment, and never forward a user-supplied host.

### 1b. Server Components: `fetch` with caching and revalidation

**Trigger:** the first page that renders backend data.
**Install:** nothing; `fetch`, `zod` and `safeFetch` ship. Source: Next.js `fetch.mdx`, `revalidateTag.mdx`, `updateTag.mdx`.

```ts
// features/posts/api/getPosts.ts (fork-created)
import 'server-only';

import { z } from 'zod';

import { safeFetch } from '@/shared/lib/api/safeFetch';
import { getUpstreamUrl } from '@/shared/lib/serverEnv'; // the fork-created accessor from 1a

const PostSchema = z.object({ id: z.string(), title: z.string() });

export const POSTS_TAG = 'posts';

export const getPosts = () =>
    safeFetch(`${getUpstreamUrl()}/posts`, z.array(PostSchema), {
        next: { revalidate: 300, tags: [POSTS_TAG] }
    });
```

**Defaults and the reason for each:**

- **Caching is opt-in** in Next.js 16 (`fetch.mdx`: the default is "auto no cache"). State the policy on every call: `next: { revalidate: N, tags: [...] }` for shared data, `cache: 'no-store'` for per-user data. Never combine both: `{ revalidate: 3600, cache: 'no-store' }` conflicts and the revalidate value is ignored.
- **`revalidate: 300`** is a placeholder for the staleness the product tolerates, in seconds. A lower per-fetch value lowers the interval of the whole route, and of two values for one URL the lower wins. The document routes in this template are ISR (`/[locale]` 3600, `/[locale]/example-form` 1800): a `revalidate: 60` fetch inside one of them makes that page regenerate every 60 seconds.
- **Tags** (max 256 characters each, max 128 per fetch) let a mutation expire exactly the affected data. After a write: `updateTag(tag)` inside a Server Action (read-your-own-writes, Server Actions only) or `revalidateTag(tag, 'max')` (stale-while-revalidate) from a Server Action or Route Handler. `revalidateTag(tag, { expire: 0 })` is for webhooks that must expire immediately. The one-argument `revalidateTag(tag)` is deprecated.
- **Memoization:** identical `GET` fetches in one render pass are deduplicated automatically, except in Route Handlers. Passing an `AbortController` signal opts a call out (`fetch.mdx`), so if you add a timeout with `AbortSignal.timeout(ms)` (standard Web API; **unverified** against Next's Data Cache, check a built app), wrap the getter in React `cache` when two components call it. A timeout is worth having: `safeFetch` has none.
- **Parallel reads:** start requests together and `await Promise.all` (or `Promise.allSettled` when one failure must not blank the page). Sequential awaits are the usual waterfall.
- **Failure path:** `safeFetch` throws on non-2xx (a plain `Error` with the status in its message), on a network `TypeError` and on `SchemaValidationError`. Let it reach `app/[locale]/error.tsx`, and log with `logger.error` with the path, never the query string.

**Guard:** add a `safeFetch.test.ts` beside `shared/lib/api/safeFetch.ts` with the first caller: a stubbed `fetch` asserts that `next.revalidate` and `next.tags` reach `fetch` unchanged, that a non-2xx throws, and that a schema mismatch throws `SchemaValidationError`. Add one test per getter for its schema. Revert-check it: removing the `init` forwarding must turn the test red.
**Security:** a `force-cache` request is cached for **any** request including POST and authorized or cookie-bearing ones, so a per-user response can be served to another user. Never use `force-cache` with `Authorization` or cookies.
**Do not:** call your own `/api` route from a Server Component (**opinion:** an extra hop through the rate limit; call the function directly). Do not put a secret in `NEXT_PUBLIC_*`.

### 1c. Server Actions with `safeFetch` + Zod

**Trigger:** the first mutation. Mirror `app/actions/example-form.ts` (input schema from the feature, result schema for the return value) instead of restating it. Source: Next.js `server-actions.mdx`, `forms.mdx`, `production-checklist.mdx`.

**Defaults and the reason for each:**

- **Authorize inside the action.** Server Actions are public POST endpoints (production checklist); a hidden button or a proxy check is not authorization. First line: the session check from Phase 2.
- **Validate the input again on the server** with the same Zod schema the form uses, and the output with the result schema, so the client receives a runtime contract.
- **Upstream write:** `safeFetch(url, schema, { method: 'POST', cache: 'no-store', headers, body })`, then `updateTag(tag)`. Auth header from the server session, never from the form.
- **Typed status:** `safeFetch` throws a plain `Error` with the status in the message. Add a small `HttpError` (extends `Error`, keeps the same message, adds `status`) thrown from the same place so callers and the retry policy in 1d can tell 4xx from 5xx. Extend, do not replace: existing callers keep working. **Inference:** a thin `apiFetch` beside `safeFetch` (base URL, auth header, timeout) is cleaner than editing `safeFetch` itself.
- **Body limit:** `serverActions.bodySizeLimit` defaults to 1MB (`serverActions.mdx`); raise it only for an upload action, in `next.config.ts` (ask-first).
- **Origin check:** Next compares the request `Origin` with the `Host` / `x-forwarded-host` header; `serverActions.allowedOrigins` takes **hosts** (Phase 7 covers the template's current value).

**Guard:** a Vitest unit test per action (valid input, invalid input, upstream 4xx, upstream 5xx) plus the unauthenticated case. **Do not:** return raw upstream error bodies to the client; map them to the result schema's `error`.

### 1d. A client island that truly needs TanStack Query

**Trigger:** an island needs polling, infinite scroll, optimistic updates, refetch on focus or a cache shared by several client components. If the data renders once per navigation, stay in 1b.
**Install:** `npm install @tanstack/react-query` (5.104 checked; peer `react` is `^18 || ^19`). Source: TanStack Query guides "Advanced Server Rendering", "Important Defaults", "Query Retries".

```ts
// shared/lib/queryClient.ts (fork-created; restores the shape of the removed file)
import {
    QueryClient,
    defaultShouldDehydrateQuery,
    environmentManager
} from '@tanstack/react-query';

import { HttpError } from '@/shared/lib/api/httpError'; // the class from 1c

const MAX_CLIENT_RETRIES = 2;

export const shouldRetry = (failureCount: number, error: unknown): boolean => {
    if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
    return failureCount < MAX_CLIENT_RETRIES;
};

const makeQueryClient = (): QueryClient => {
    const isServer = environmentManager.isServer();
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60_000,
                gcTime: 5 * 60_000,
                retry: isServer ? false : shouldRetry,
                refetchOnWindowFocus: false
            },
            mutations: { retry: false },
            dehydrate: {
                shouldDehydrateQuery: (query) =>
                    defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
                shouldRedactErrors: () => false
            }
        }
    });
};

let browserClient: QueryClient | undefined;

/** Server: a new client per call (never shared between requests). Browser: one singleton. */
export const getQueryClient = (): QueryClient => {
    if (environmentManager.isServer()) return makeQueryClient();
    return (browserClient ??= makeQueryClient());
};
```

**Defaults and the reason for each:**

- **`staleTime: 60_000`** is the guide's SSR value: above zero, so the client does not refetch the instant it hydrates data the server just fetched. The removed template file used five minutes; pick by how fresh the data must be. `gcTime` is already five minutes by default; it is written out so the number is visible.
- **`retry`:** a function, not a number, so a 4xx (a client error that cannot succeed on retry) fails at once while 5xx and network errors retry with the default exponential delay (1 second doubling, capped at 30 seconds). `failureCount` starts at 0. Servers default to no retries (render speed, "Query Retries"); **inference:** an explicit `retry` option replaces that default, which is why the server branch returns `false`.
- **`refetchOnWindowFocus: false`** (**opinion**; the library default is on): avoids a refetch storm on every tab switch for data that does not need it. Turn it back on per query for dashboards.
- **`shouldDehydrateQuery` including `pending`** lets a prefetch started on the server stream to the client without being awaited; `shouldRedactErrors: () => false` is the guide's setting because Next.js itself redacts server errors and relies on its own errors propagating to detect dynamic pages (comment in the guide's example).
- **Singleton rules:** never a module-level client on the server (it would leak data between users), and never `useState` to hold the browser client in a provider that can suspend (guide). `cache(() => new QueryClient())` from React is the documented alternative that shares one client per request.

**Plug in:** prefetch in the Server Component and hydrate; the client reads with `useSuspenseQuery`. The `queryFn` that runs in the browser cannot import a `server-only` getter: point it at a Route Handler that calls the same getter (it passes the proxy rate limit, so a short polling interval counts against the 100 requests per 60 seconds), or at a public CORS-enabled API with `safeFetch`.

```tsx
// app/[locale]/posts/page.tsx (fork-created)
import { HydrationBoundary, dehydrate, noop } from '@tanstack/react-query';

import { getQueryClient } from '@/shared/lib/queryClient';

const queryClient = getQueryClient(); // inside the component body, not module scope
void queryClient.query({ queryKey: postsKeys.all, queryFn: getPosts }).catch(noop);

return (
    <HydrationBoundary state={dehydrate(queryClient)}>
        <PostsList />
    </HydrationBoundary>
);
```

`queryClient.query(...)` is the current API; `prefetchQuery`, `fetchQuery` and `ensureQueryData` are deprecated in 5.104 (the guide's replacement for `ensureQueryData` is `query({ staleTime: 'static' })`). Keep keys in a factory (`postsKeys.all`, `postsKeys.detail(id)`) so invalidation after a mutation targets a prefix. Mount `QueryClientProvider` in the layout of the subtree that uses it, not in `app/providers.tsx` (**opinion:** keeps the library off ISR marketing routes; confirm with `npm run size:check`, and raising a budget is a gate-file edit that `AGENTS.md` lists as ask-first). `ReactQueryStreamedHydration` is experimental in the guide; do not default to it.

**Guard:** a Vitest unit test for `shouldRetry` (403 false, 500 true until the cap, a network `TypeError` true) and for `getQueryClient` (two server calls give two instances, two browser calls give one; the server case needs `// @vitest-environment node` because the repo's default is jsdom, **unverified** against Vitest's current docs, check before relying on it).
**Security:** `dehydrate` serialises query data into the HTML, so prefetch only what the current user may see, and key per-user data by user id so a shared client can never serve it to someone else.
**Do not:** wrap the whole root layout in the provider; use `useQuery` for data a Server Component can render; duplicate server-fetched data into Zustand.

---

## Phase 2 — Auth

The template ships the rules, not a mechanism: `SECURITY_REQUIREMENTS.md` (session section) says the token lives in an `HttpOnly; Secure; SameSite=Lax` cookie set by the server and that client code never reads or stores it, and `proxy.ts` has a rate limit and CSP but no session code. Sources: Next.js `authentication.mdx` (the guide), `cookies.mdx`, `proxy.mdx`, `data-security.mdx`; next-intl `redirect` from its navigation docs.

### Choose one (who owns the session)

| Option                                                                                                                                                    | Pros                                                                                                  | Cons                                                                                                                    | When to pick                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Backend owns the session** (default; opaque cookie set by the API; Next forwards it to a `GET /me`-shaped endpoint)                                     | Matches `SECURITY_REQUIREMENTS.md` as written; no signing secret in Next; revocation is the backend's | A backend round trip per request (dedupe it with React `cache`); the cookie `Domain` and `Path` must cover this app     | A backend already authenticates users                |
| **Library or hosted provider** (the guide lists Auth0, Better Auth, Clerk, Descope, Kinde, Logto, NextAuth.js, Ory, Stack Auth, Supabase, Stytch, WorkOS) | Least code; MFA, social login and password reset come with it                                         | Vendor origins to allow in the CSP; the Proxy runs on the Node.js runtime, so check the library's compatibility (guide) | No identity system yet                               |
| **Self-managed signed cookie with `jose`** (2a-2e)                                                                                                        | No datastore; small, auditable code                                                                   | No revocation before expiry (**inference**: a stateless token cannot be recalled); you own secret rotation              | A backend-for-frontend with no user table of its own |

The backend-owned row is the default because it is the one `SECURITY_REQUIREMENTS.md` describes ("Identity comes from an endpoint, never from parsing a cookie"). 2a and 2b are written for the self-managed row, which needs the most code. With a backend-owned session, 2a's secret and `createSession` disappear, `verifySession` forwards the cookie to the identity endpoint instead of calling `decrypt`, and the 2c proxy check can only test that the cookie is present. 2d and 2e apply to every row.

### 2a. Secret and cookie options

**Trigger:** the first login. **Install (self-managed option):** `npm install jose` (6.2 is what `npm view jose version` returned when this file was written; the guide imports `SignJWT` and `jwtVerify`).
**Plug in:** generate the secret with `openssl rand -base64 32` (the guide), keep it in a server-only `SESSION_SECRET`, declare it empty in `.env.example` and validate it in the server-only env module from 1a, never in `shared/lib/env.ts`.

**Defaults and the reason for each:**

- **`httpOnly: true`**: page scripts cannot read the cookie, so an XSS bug cannot copy the session.
- **`secure`**: `true`, or `process.env.NODE_ENV === 'production'` (both forms appear in the guide); the second keeps plain-http local development working (**opinion**).
- **`sameSite: 'lax'`**: the guide's value and the one `SECURITY_REQUIREMENTS.md` requires; a cross-site POST does not carry the cookie, a top-level link navigation does, so a link in an email still lands signed in.
- **`path: '/'`** and **`expires`**: the guide's example is 7 days. Pick the shortest life the product tolerates (**opinion**) and re-issue on activity (guide, "Updating sessions").
- **Where it is set:** only in a Server Action or Route Handler (`cookies.mdx`: setting cookies during Server Component rendering is not supported).
- **Name prefix** (**training data, may be stale**): a `__Host-` prefix makes browsers require `Secure`, `Path=/` and no `Domain`. It conflicts with the cross-app `Domain` scoping `SECURITY_REQUIREMENTS.md` describes, so choose one.

### 2b. Session module and Data Access Layer

```ts
// entities/session/api/session.ts (fork-created)
import 'server-only';

import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { getSessionSecret } from '@/shared/lib/serverEnv'; // the fork-created accessor from 1a

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 7;
const PayloadSchema = z.object({ userId: z.string().min(1) });

const key = () => new TextEncoder().encode(getSessionSecret());

export const createSession = async (userId: string) => {
    const token = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${String(SESSION_DAYS)}d`)
        .sign(key());

    (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    });
};

export const decrypt = async (token: string | undefined) => {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
        const parsed = PayloadSchema.safeParse(payload);
        return parsed.success ? parsed.data : null;
    } catch {
        return null; // expired, tampered or malformed all mean "no session"
    }
};
```

```ts
// entities/session/api/dal.ts (fork-created): never imported by proxy.ts
import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { redirect } from '@/i18n/navigation';

import { decrypt, SESSION_COOKIE } from './session';

// Memoized per request: every caller in one render shares one verification.
export const verifySession = cache(async (locale: string) => {
    const session = await decrypt((await cookies()).get(SESSION_COOKIE)?.value);
    if (!session) {
        return redirect({ href: '/login', locale });
    }
    return session;
});
```

The two-file split is the guide's (its `session.ts` for the token, its `dal.ts` for `verifySession`), and it matters here: `proxy.ts` imports only `session.ts`, so the proxy bundle never pulls in React `cache` or next-intl's navigation helpers. The shape follows the guide's session and DAL examples (`jose` `SignJWT` / `jwtVerify` with `algorithms` pinned, `server-only`, React `cache`). Two deliberate differences: the guide's `catch` calls `console.log`, which this repo's lint rules forbid, and the `redirect` is next-intl's (`i18n/navigation.ts`, which requires an explicit `locale`) so the login URL keeps the locale prefix that `localePrefix: 'always'` demands. **DTOs:** every DAL getter returns the few fields a component needs, never the raw backend record (guide, "Using Data Transfer Objects"). Client Components cannot import the DAL: verify in a parent Server Component and pass props down (guide, "Auth and streaming").

### 2c. Optimistic check in `proxy.ts` (ask-first)

**Trigger:** whole sections behind login, so an anonymous visitor is redirected before any render, and static pages with shared paid content that must stay protected (the guide names both uses).
**Plug in:** `proxy.ts`, **immediately before** `return intlMiddleware(request)` and after the asset skip, the rate limit, the production `/dev` gate and the `/api` and `/dev` nonce block. Do not reorder those: the rate limit must keep running first. The check reads only the cookie (`request.cookies.get(...)`, the guide's tip) and verifies the signature; no database or backend call, because the Proxy also runs on prefetches (guide).

```ts
// proxy.ts, immediately before `return intlMiddleware(request);`
const [, maybeLocale, ...segments] = request.nextUrl.pathname.split('/');
if (hasLocale(routing.locales, maybeLocale)) {
    const path = `/${segments.join('/')}`;
    const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
    if (isProtected && !(await decrypt(request.cookies.get(SESSION_COOKIE)?.value))) {
        return NextResponse.redirect(new URL(`/${maybeLocale}/login`, request.url));
    }
}
```

`PROTECTED_PREFIXES` is a constant in `shared/constants/index.ts` (no magic strings). Paths arrive locale-prefixed because the Proxy runs before next-intl; an unprefixed request such as `/dashboard` falls through to `intlMiddleware`, which redirects it to `/en/dashboard`, and the check runs on that second request. `hasLocale` is next-intl's own guard, already used in `i18n/request-locale.ts`.
**Guard:** extend `proxy.test.ts` (it now imports `session.ts`, so add `vi.mock('server-only', () => ({}))`, Phase 1a): no cookie, a tampered cookie and an expired cookie on a protected path redirect to the localized login; a valid cookie passes; `/api` and `/dev` are untouched; the existing 429 test stays green, and add one that an over-limit Server Action POST (a request carrying a `next-action` header) to a protected path is still answered by the limiter before the session check runs. This file is in the `proxy.ts` ask-first group, so review it as a security change.

### 2d. Authorize where the data is read

- **Call `verifySession(locale)` in the page or the data getter**, not only in a layout: layouts do not re-render on navigation, and a layout does not decide whether other segments render (guide, "Layouts and auth checks").
- **`cookies()` makes a route dynamic** (`cookies.mdx`). Never call it, or the DAL, in the root layout or in the two ISR document routes `/[locale]` and `/[locale]/example-form`; doing so ends their ISR. A header user menu goes in a nested Server Component inside `<Suspense>` so the rest of the page still streams (guide, "Auth and streaming").
- **Server Actions and Route Handlers re-check the session first**, before parsing input: both are public endpoints (production checklist, `data-security.mdx`). A Route Handler answers `401` JSON instead of redirecting and sets `Cache-Control: private, no-store` on per-user responses (**opinion**: standard HTTP semantics, not a Next.js rule).
- **A valid session is not permission.** Compare `session.userId` with the resource owner on every read and write, or any user can fetch another user's record by id.

### 2e. Login, logout and the failure path

- **Login action:** Zod-validate the input, call the backend, `createSession`, `redirect`. Return one generic message for every credential failure so the form does not reveal which accounts exist (**opinion**).
- **A stricter limiter than the proxy's.** The proxy allows 100 requests per 60 seconds per client for `/api` and every Server Action, far too loose for password guessing. Add a second `Ratelimit` with its own key prefix and a small window, keyed by client IP plus the attempted account (**opinion**); `shared/lib/upstashRateLimit.ts` and `shared/lib/rateLimitCore.ts` show the pattern and the in-memory fallback.
- **Logout:** `(await cookies()).delete(SESSION_COOKIE)` in a Server Action, then redirect (`cookies.mdx`: `delete` is allowed in a Server Function or Route Handler). With a stateless token this does not revoke a copy the attacker already holds (**inference**); use a backend-owned or database session when you need revocation.
- **Social login:** the template sends `Cross-Origin-Opener-Policy: same-origin`, which breaks popup-based OAuth. Use a full-page redirect flow, started from a link or a GET Route Handler rather than a form POST (**inference**: `form-action 'self'` in the CSP can interfere with a form whose redirect leaves the origin; verify in the target browsers). Allow a provider origin in `shared/lib/cspHeader.ts` only when its SDK needs one.

**Guard:** a Vitest unit test for the session module: round trip; expired token rejected; token signed with another secret rejected; payload without `userId` rejected; a token whose header names a different algorithm rejected. Run it in the Vitest node environment (the repo default is jsdom; the per-file `@vitest-environment node` docblock is **unverified** here, so check the Vitest docs for the repo's version before relying on it). Unit-test the login action for valid, invalid and rate-limited input.
**Security:** use at least 32 random bytes for the secret and never a `NEXT_PUBLIC_` name; rotating `SESSION_SECRET` signs every user out (**inference**: single-key verification). Never log a token or cookie value. CSRF: Server Actions compare `Origin` with `Host` (`serverActions.mdx`), `SameSite=Lax` keeps the cookie off cross-site POSTs, and `requireSameOrigin` guards mutating `/api` methods (README); a `GET` must never change state.
**Docs to update in the same PR:** the self-managed option contradicts the wording "the app never reads it" in `SECURITY_REQUIREMENTS.md`: the server reads the cookie, client code never does. Reword that bullet; do not leave two statements.
**Do not:** make the proxy the only check (guide: do the checks close to the data); do the check only in a layout; read the cookie in client code; put the token in `localStorage` or `sessionStorage`; hand-roll password hashing or token crypto (**opinion**); copy the guide's `console.log` into the `catch`.

---

## Phase 3 — Error monitoring (Sentry as the worked example)

The seam already exists: `shared/lib/logger.ts` routes `logger.error` to `report.capture` and `logger.info` / `logger.warn` to `report.breadcrumb`, both no-ops under `TODO(observability)`, and `app/[locale]/error.tsx` and `app/global-error.tsx` already call `logger.error`. Wiring a vendor behind `report` keeps every call site untouched, which is the TODO's own contract. Sources: Sentry's Next.js guides "Manual Setup", "Source Maps", "Webpack Setup", "Capturing Errors" and the SDK Options and Filtering pages; Next.js `instrumentation.mdx`, `compiler.mdx`.

### Choose one

| Option                                      | Pros                                                                         | Cons                                                                               | When to pick                |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| **`@sentry/nextjs`** (default)              | Server and browser errors, readable stack traces, release tracking, a tunnel | Vendor cost and data residency; adds client JavaScript (the bundle budget notices) | Any product with real users |
| **Platform logs and alert rules only**      | No client JavaScript, no vendor                                              | Browser errors are invisible; stack traces stay minified                           | Internal tools, prototypes  |
| **Another vendor SDK** (Datadog, and so on) | Fits a company-wide standard                                                 | Same wiring, different init files; read that vendor's Next.js guide                | The company mandates one    |

### 3a. Install, init files and the seam

**Trigger:** the first deploy that real users see. **Install:** `npm install @sentry/nextjs --save` (Sentry's guide; 11.4 was current when this file was written, with a peer range that accepts `next` 16). Create these files at the project root (the repo has no `src/`):

```text
instrumentation-client.ts   # browser init + onRouterTransitionStart (fork-created)
sentry.server.config.ts     # Node.js init (fork-created)
sentry.edge.config.ts       # only if an edge-runtime route exists (fork-created)
instrumentation.ts          # register() + onRequestError (fork-created)
```

```ts
// instrumentation.ts (fork-created); register() is guarded by NEXT_RUNTIME (instrumentation.mdx)
import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
    if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}

export const onRequestError = Sentry.captureRequestError;
```

```ts
// instrumentation-client.ts (fork-created); the server file differs only in the missing router hook
import * as Sentry from '@sentry/nextjs';

// Sentry: `enabled: false` still leaves instrumentation overhead; init conditionally to switch it off entirely.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NEXT_PUBLIC_APP_ENV, // the variable name is yours
        tracesSampleRate: 0.1,
        dataCollection: { userInfo: false }
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

**The seam** (`shared/lib/logger.ts`, replacing the no-op `report`):

```ts
import * as Sentry from '@sentry/nextjs';

const report = {
    breadcrumb: (level: 'info' | 'warn', message: string, data?: Record<string, unknown>): void => {
        Sentry.addBreadcrumb({ level: level === 'warn' ? 'warning' : 'info', message, data });
    },
    capture: (error: Error, context?: Record<string, unknown>): void => {
        Sentry.captureException(error, { extra: context });
    }
};
```

`captureException(error, { extra })` is shown in the Capturing Errors guide; the `addBreadcrumb` signature lives on the Enriching Events page, which was **not read**, so verify it before copying. Also change `app/global-error.tsx`: it calls `logger.error` during render, so a capture there would fire on every re-render (**inference**); move the call into a `useEffect` keyed on `error`, as Sentry's own example does.

**Defaults and the reason for each:**

- **DSN in `NEXT_PUBLIC_SENTRY_DSN`:** the guide allows a public variable because the DSN is not a secret. Declare it in `.env.example` and the env schema. Leaving it unset in local and preview environments turns monitoring off with zero overhead.
- **`tracesSampleRate: 0.1`:** the guide's production example (100% in development). Tune it to traffic and the plan's quota; start at errors only if cost matters (**opinion**).
- **`dataCollection: { userInfo: false }`:** by default the SDK sends IP address, user ID, HTTP bodies and URL query parameters (guide, "Control the data you send"). Opt out of what the product does not need, and treat `context` passed to `logger.error` as outgoing data: never put an email, token or full payload in it.
- **`environment` and `release`:** set `environment` per deploy (`production`, `staging`, `preview`). The release should be the commit SHA so regressions map to deploys; the server reads `SENTRY_RELEASE`, the browser reads `window.SENTRY_RELEASE.id` (SDK Options page). Giving the client the same value through a build-time `NEXT_PUBLIC_` variable passed to `release` is the simplest route (**inference**).
- **Filtering:** start without `ignoreErrors`. Add entries only for noise you have actually seen (`ignoreErrors` partial-matches messages; `beforeSend` is the last chance to drop or edit an event, Filtering page). Pre-filling from a list found online hides real errors (**opinion**).
- **Replay:** off at first. It adds client weight and records user sessions, so it needs a privacy review before `replaysSessionSampleRate` is set above zero (**opinion**); when enabled, `worker-src 'self' blob:` already permits its worker.

### 3b. `next.config.ts` and source maps (ask-first)

The export today is `withNextIntl(withBundleAnalyzer(nextConfig))`. Wrap it outermost, `withSentryConfig(withNextIntl(withBundleAnalyzer(nextConfig)), { ... })` (**inference** on the ordering; the guide only shows the single-wrapper case). `withSentryConfig` is imported from `@sentry/nextjs/config` in the current guide. `build` here is `next build --webpack`, so Sentry's **webpack** page applies: source maps upload during the build, and the webpack-only options work.

- **`org`, `project`, `authToken: process.env.SENTRY_AUTH_TOKEN`:** the token is set in CI only. It is a secret: never `NEXT_PUBLIC_`, never a value in `.env.example`.
- **`sourcemaps.deleteSourcemapsAfterUpload`** defaults to `true` and deletes client maps only (server maps stay for runtime reporting): keep it, so users never download your source. `widenClientFileUpload` (default `false`) also uploads dependency maps to fix `[native code]` frames, at the cost of upload time; turn it on only if those frames hurt.
- **`useRunAfterProductionCompileHook: true`** uploads after the build instead of during it (the Sentry build-options page names a minimum Next.js release for it, and the repo's major is above that minimum).
- **`webpack.excludeServerRoutes`:** exclude high-volume beacons such as `/api/vitals` and `/api/csp-report` from instrumentation (**opinion**; routes are URL paths with a leading slash). `webpack.treeshake.removeDebugLogging: true` drops Sentry's debug logger from the bundle.
- **Tunnel (optional):** `tunnelRoute: '/sentry-tunnel'` sends events through your own origin, so `connect-src 'self'` still holds and ad blockers do not drop them. Without it, add the DSN's ingest origin to `connect-src` in `baseCspDirectives` (`shared/lib/cspHeader.ts`, relative imports only because `next.config.ts` imports it). The proxy matcher in `proxy.ts` must exclude the tunnel path, as Sentry's guide says for a proxy that intercepts requests: the current third matcher entry would otherwise route it into `intlMiddleware` and redirect it to a locale prefix. A path under `/api/` avoids the matcher edit but would count against the proxy's 100-per-60-seconds limiter (**inference**), so prefer a top-level path and rate-limit it at the host (Phase 7).

**Bundle budget:** the SDK adds first-load JavaScript, so `npm run size:check` will go red. `scripts/bundle-budget.json` is a gate file (ask-first): re-measure, raise the limit deliberately and record the measurement in the commit message, as `DECISIONS.md` § "First-load JS budget" requires.
**Check before relying on logs as a drain:** `next.config.ts` sets `compiler.removeConsole` to `{ exclude: ['error', 'warn'] }` in production, while `shared/lib/logger.ts` prints its production JSON through `console.log` for every level. `compiler.mdx` says `removeConsole` removes `console.*` output except the excluded methods; it does not say whether server bundles are affected. **Unverified:** build for production and check that an `info` line still appears in the server output before building alerts on structured logs.
**Guard:** extend `shared/lib/logger.test.ts` with a `vi.mock('@sentry/nextjs')`: `logger.error(message, error, context)` calls `captureException` once with that error and context, `logger.error(message)` with no error builds an `Error` from the message, and `info` / `warn` add a breadcrumb. After the first deploy, throw one test error from a preview deployment (the guide's "Throw a Test Error" step) and confirm a readable, de-minified stack trace.
**Security:** a client DSN is public by design, so rate-limit and project-scope it in Sentry's settings rather than hiding it. Source maps stay in Sentry, not in the public build. Review `beforeSend` whenever a form with personal data ships.
**Do not:** capture in both `error.tsx` and the seam (Sentry's "Duplicate Errors": pick one location per error; the seam is the one here); import `@sentry/nextjs` from feature code (FSD: go through `logger`); commit the auth token; ship client source maps; enable Replay or user data without a privacy review.

---

## Phase 4 — Analytics (consent-aware)

Today there is no analytics vendor: `app/providers.tsx` holds an empty idle-callback placeholder, and `app/WebVitalsReporter.tsx` posts Core Web Vitals to `app/api/vitals/route.ts`, which only logs them. Adding a vendor is ask-first (`AGENTS.md`, escalation list). Whether and when consent is required depends on the vendor, the data it collects and the jurisdictions you serve; that is a legal question this file does not answer, so the default below sends nothing until the visitor opts in (**opinion**).

### Choose one

| Option                                         | Pros                                              | Cons                                                                              | When to pick                        |
| ---------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| **Google Analytics via `@next/third-parties`** | The documented Next.js integration; one component | Third-party data processing; CSP origins to add; no consent hook in the component | You need GA specifically            |
| **A cookieless or self-hosted vendor**         | May reduce consent obligations (a legal question) | Not researched here (**unverified**): read that vendor's Next.js guide            | Privacy is a product feature        |
| **Keep the log-only vitals route**             | Zero third parties, zero consent surface          | No dashboards, no per-user funnels                                                | Content sites that only watch speed |

### 4a. Install and mount only after consent

**Trigger:** the first request for a funnel or traffic number. **Install:** `npm install @next/third-parties` (the Next docs show `npm install @next/third-parties@latest next@latest`; skip the `next@latest` half here, since the installed `next` already satisfies the package's peer range, checked with `npm view` when this file was written). Its `GoogleAnalytics` component takes only `gaId`, `dataLayerName`, `debugMode` and `nonce`: there is no consent prop (Next docs, third-parties guide, and the package source), so the gate is yours.

**Plug in:** `app/providers.tsx` is the client boundary the layout already wraps around `children`; replace the empty `initAnalytics` placeholder there. Add `NEXT_PUBLIC_GA_ID` to `.env.example` and to the explicit key list in `getPublicEnv()` in `shared/lib/env.ts` (the schema reads each `NEXT_PUBLIC_` key by literal name so Next can inline it).

```tsx
// app/providers.tsx (fork-edited). `useConsent` is a fork-created store, for example in
// features/consent/ (zustand is installed); it persists the choice in a first-party cookie or localStorage.
'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import type { FunctionComponent, ReactNode } from 'react';

import { useConsent } from '@/features/consent';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const Providers: FunctionComponent<{ children: ReactNode }> = ({ children }) => {
    const analyticsGranted = useConsent((state) => state.analytics);

    return (
        <>
            {children}
            {GA_ID && analyticsGranted ? <GoogleAnalytics gaId={GA_ID} /> : null}
        </>
    );
};
```

**Why mount-after-grant is the default:** Google's consent-mode setup requires the `gtag('consent', 'default', {...})` call to run **before** the tag's own `config` call ("if your consent code is called out of order, consent defaults won't work", Google tag platform consent guide). The component emits `gtag('config', ...)` inside its own inline script and offers no place to run a default first, so with this component the only reliable consent gate is not rendering it. Real consent mode (load the tag with denied defaults, then `gtag('consent', 'update', {...})` after the choice, plus `wait_for_update`, `ad_user_data`, `ad_personalization`) needs your own inline script placed ahead of the tag; whether two `next/script` tags keep that order, and what basic versus advanced consent mode sends before a grant, are **unverified** here. Take that step only after the legal decision.

**Withdrawal:** give visitors a control that flips the stored choice back, as easy as granting it (**opinion**; check local law). Unmounting the component does not unload a script that already ran (**inference**), so reload the page on withdrawal.

**Events:** `sendGAEvent('event', 'name', { ...params })` from `@next/third-parties/google` pushes to the data layer and only works while the component is mounted; keep event names and parameters in a constants file, never inline strings (house rule), and never put an email or a free-text field in a parameter.

### 4b. CSP and the layout preconnect (ask-first)

Production documents use the static policy (`'self' 'unsafe-inline'` for scripts), so the inline init script runs and `nonce` on the component does not apply (ISR HTML has no per-request nonce, see `shared/lib/cspHeader.ts`). What must change is the allowlist, in `shared/lib/cspHeader.ts`:

- **`script-src`:** add `https://www.googletagmanager.com` to the production value in `buildStaticContentSecurityPolicy`.
- **`connect-src`:** add `https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com` in `baseCspDirectives` (Google tag platform CSP guide, which lists `script-src-elem`, `img-src` and `connect-src`; `img-src` already allows `https:` here). The guide was read through a summarising fetch, so re-check the host list against the page before shipping.
- **Nonce policy:** leave it alone. `/api` and `/dev` render no analytics, and a nonce plus `'strict-dynamic'` policy ignores host allowlists in browsers that support it (CSP spec, **training data**).
- **Layout preconnect:** `app/layout.tsx` carries no connection hint, and `e2e/smoke.spec.ts` fails a page that gains a `preconnect` or `dns-prefetch` to another origin. A hint to the vendor opens a connection to Google on every page view, before any consent (**inference**), so add it only inside the consent-gated branch, and allow that origin in the smoke test next to the grant.

### 4c. Core Web Vitals to the vendor (ask-first)

`/api/vitals` is a log sink; expanding it is ask-first in `AGENTS.md`. To feed GA, follow the Next docs example inside the reporter: `value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)` (values must be integers), `event_label: metric.id`, `non_interaction: true` (Next docs, `analytics` guide), and send it only when consent is granted. Keep the log route as the consent-free fallback.

**Guard:** extend `shared/lib/cspHeader.test.ts`: the production static policy lists the vendor origins in `script-src` and `connect-src`, and the nonce policy still has no host allowlist. Add a `Providers` test: nothing vendor-specific renders before a grant, and it renders after one (mock `@next/third-parties/google`). Confirm in a production build that the document has no request to the vendor before the grant (Network panel).
**Security:** a measurement ID is public, so validate its shape with Zod (the Next docs say it usually starts with `G-`) rather than trusting any string, because the component interpolates it into an inline script. Third-party scripts run with full page privileges: load only the ones you listed, never a tag manager container that marketing can edit without review (**opinion**).
**Do not:** render the vendor unconditionally "for now"; add `'unsafe-eval'` or `https:` to `script-src`; send identifiers or personal data as event parameters; put the measurement ID in a server-only variable (it is read in a client component).

---

## Phase 5 — i18n growth (a second language)

Today `i18n/routing.ts` has `locales: ['en']` with `localePrefix: 'always'`, `i18n/request.ts` validates the locale with `hasLocale` and loads `messages/<locale>.json`, and every page derives its hreflang data from `routing.locales`. README "Adding Languages" lists two steps; the recipe below is the full list, because two of the steps it omits break a second language (the document `lang` attribute, and message parity). Sources: next-intl 4.14 docs (routing setup, configuration, the 4.0 release notes on the locale cookie) and the Next.js layout docs.

### 5a. Add the locale

**Trigger:** a market or a language you will actually translate; do not add a locale to "test" the setup, since each one multiplies prerendered pages (`generateStaticParams` in `app/[locale]/layout.tsx` maps over `routing.locales`) and sitemap entries (`app/sitemap.ts` emits one entry per route per locale). No install: next-intl is already present.

1. Add the code to `locales` in `i18n/routing.ts` (keep `as const`; `defaultLocale` stays what it is).
2. Create `messages/<code>.json` from `messages/en.json`. Translate values only; keys must match.
3. Keep `localePrefix: 'always'` so every URL stays explicit and stable. The proxy matcher needs no change: its third pattern already covers `/<locale>/...` documents.
4. Page metadata and the sitemap already list every locale in `alternates.languages` (`app/[locale]/page.tsx`, `app/[locale]/example-form/page.tsx`, `app/sitemap.ts`), so a new page must copy that block. next-intl's middleware also emits alternate `Link` headers by default (`alternateLinks: false` opts out); the three sources derive from one list here, keep it that way.

**Guard (message parity):** the loader does a dynamic import, so a missing key surfaces at render time on one page, not at build. Add a test that fails when any locale file has a different key set from `en.json`:

```ts
// messages/messages.test.ts (fork-created)
import { describe, expect, it } from 'vitest';

import { routing } from '@/i18n/routing';

const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([key, child]) => flatten(child, `${prefix}${key}.`))
        : [prefix];

describe('message parity', () => {
    it.each(routing.locales)('%s has exactly the keys of en', async (locale) => {
        const reference = flatten((await import('@/messages/en.json')).default).sort();
        const keys = flatten((await import(`@/messages/${locale}.json`)).default).sort();
        expect(keys).toEqual(reference);
    });
});
```

Also extend `app/sitemap.test.ts` so that, with two locales, every entry's `alternates.languages` lists both. Optional: next-intl can generate a typed message declaration from `messages/en.json` through the plugin's `createMessagesDeclaration` option, which its docs mark `experimental`; this repo does not use it.

### 5b. The `<html lang>` attribute (structural, ask-first)

**Finding first:** `app/layout.tsx` hard-codes `<html lang="en">` and `app/global-error.tsx` does the same, so a `de` page would still declare English to screen readers and browsers' translation prompts. Setting it per locale needs the locale in the layout that renders `<html>`. The documented route: Next.js allows root layouts under a dynamic segment ("useful for implementing internationalization", `layout` file convention docs). `app/[locale]/layout.tsx` already narrows the locale from `params` with `requireLocale` and calls `setRequestLocale`; it keeps doing both and only starts rendering `<html>`:

```tsx
// app/[locale]/layout.tsx becomes the root layout: it renders html and body
const LocaleLayout = async ({ children, params }: LocaleLayoutProps): Promise<ReactElement> => {
    const locale = requireLocale((await params).locale);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the static-rendering call every localized entry keeps; moving to next/root-params is a routing migration, not a lint fix
    setRequestLocale(locale);
    return (
        <html lang={locale} /* dir={...} for right-to-left locales */ className={...}>
            <body>{/* the providers the old app/layout.tsx rendered */}</body>
        </html>
    );
};
```

What moves, and what to watch:

- Delete `app/layout.tsx` and move its fonts, `metadata`, `WebVitalsReporter`, `Providers` and the globals import into the locale layout. Metadata exports in the old file become `generateMetadata`, merged with the existing one there.
- **The title cascade breaks.** `title.template` (`'%s | ...'` in `app/layout.tsx` today) does not apply to a `page` in the segment that defines it (Next.js `generate-metadata` docs, `title.template`), and `app/[locale]/page.tsx` sits in the same segment as the new root layout, so the home page loses its suffix. That is exactly what the `AGENTS.md` i18n contract and the README "title.template cascade" caveat forbid. Give the home page `title: { absolute: ... }` with the brand written out, keep `title.default` and `title.template` in the locale layout for the deeper pages, and rewrite both docs in the same pull request. `e2e/smoke.spec.ts` asserts the suffixed home title, so it catches a miss; `app/[locale]/page.test.tsx` expects the bare title and changes with the page.
- `app/dev/ui/` and any route outside `[locale]` need their own root layout (for example under a route group); navigating between two root layouts is a full page load (Next.js route groups docs). The dev pages are 404 in production, so this costs nothing there.
- `app/global-error.tsx` replaces the root layout when it renders, so it keeps its own `<html>` and cannot read the locale; leave it at `lang="en"` and accept that (**inference**; unverified).
- Whether moving `<html>` into the locale layout keeps the two ISR routes static is **unverified**: build with two locales and confirm `/en` and `/de` still show as prerendered before merging. `setRequestLocale` stays in every layout and page, as today.

### 5c. Links, redirects and the locale cookie

- Import `Link`, `redirect`, `usePathname`, `useRouter` and `getPathname` from `i18n/navigation.ts`, never from `next/link` or `next/navigation`, so the prefix is added for you. `redirect` there needs an explicit `locale`: `redirect({ href, locale })` (the Phase 2 `dal.ts` already does this).
- With one locale there is no `NEXT_LOCALE` cookie to think about; with two or more, next-intl sets a **session** cookie of that name only when a visitor switches to a locale that differs from their `accept-language` header (next-intl 4.0 release notes, "GDPR compliance"). Treat it as a functional cookie when you write the consent text, and do not rely on it being present. `localeCookie: false` in `defineRouting` turns it off; a `maxAge` makes it persistent, which changes the consent answer.
- Never build locale URLs by string concatenation in new code; the one place that does is `app/sitemap.ts`, which needs the absolute URL.

**Security:** locale values come from the URL, so keep validating through `requireLocale` in `i18n/request-locale.ts` (it calls `notFound()` for unknown values) in every new layout, page and route handler that reads `params.locale`; do not interpolate it into a file path or an import specifier without that check (the loader's dynamic import is safe only because `hasLocale` runs first).
**Do not:** add a locale without its messages file (the build will not tell you); translate by string-replacing the `en` file at runtime; detect the language from the IP address; mix `next/link` and the next-intl `Link` in one component tree.

---

## Phase 6 — Images and CDN

Today the tree has no `next/image` usage and no image files; the only `/_next/image` references are the proxy's asset skip (`shared/lib/middlewareRequest.ts`, so the optimizer is outside the rate limit) and its test. `next.config.ts` carries an `images` block (`formats: ['image/avif', 'image/webp']`, `remotePatterns: []`, `minimumCacheTTL: 60`, explicit `deviceSizes` and `imageSizes`), and `shared/lib/cspHeader.ts` sets `img-src 'self' data: https:`. Sources: the Next.js 16 `next/image` reference, the images guide and the CDN caching guide (all read against the installed major; the `assetPrefix` page was read through context7 at v16.2.9).

### 6a. Remote images (a CMS, an upload bucket, a partner host)

**Trigger:** the first image whose `src` is an absolute URL. No install.

**What to wire:**

- One object per host in `images.remotePatterns` with all four fields: `protocol: 'https'`, the exact `hostname`, a `pathname` pinned to your account or bucket prefix, and `search: ''`. The docs say an omitted field implies `**` and that this "is not recommended because it may allow malicious actors to optimize urls you did not intend". An unmatched `src` answers `400`, which is the behaviour you want.
- `images.maximumRedirects: 0` unless your image host redirects. The docs say an allowed remote that redirects is followed without re-checking `remotePatterns` on the new location, and the default follows up to 3 hops.
- Leave `dangerouslyAllowLocalIP` and `dangerouslyAllowSVG` unset. The first is an SSRF opening on a private network (the docs' words: "only enable once you understand the SSRF risk"). If SVG is ever needed, the docs pair it with `contentDispositionType: 'attachment'` and `contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"`, and recommend the `unoptimized` prop for a known SVG (automatic when `src` ends in `.svg`).
- Do not use `images.domains`: the docs mark it deprecated in favour of `remotePatterns` (no wildcards, no protocol, port or path limits).
- `images.qualities`: unset means `[75]` (the page's stated default, introduced with the major in use). Add values only if a component passes another `quality`; the nearest allowed value is used otherwise. The page also calls the field "required", so write it explicitly when you set a second value.

**CSP (ask-first, `shared/lib/cspHeader.ts`):** `remotePatterns` gates only the optimizer. The browser may still load any `https:` image because `img-src` allows it. Once the hosts are known, replace `https:` with the explicit origins and keep `'self' data:` (the `data:` source covers `blurDataURL` placeholders, which are data URLs). Update `shared/lib/cspHeader.test.ts` in the same change. This is opinion about defaults, not a Next.js requirement.

**Guard:** `next.config.test.ts` already imports the config. Add a test that every `images.remotePatterns` entry has `protocol: 'https'`, a `hostname` that is not a bare `**`, a `pathname`, and `search: ''`, so a broad pattern fails review rather than shipping.

### 6b. Optimizer cost and cache lifetime

- `minimumCacheTTL: 60` is far below the documented default (14400). Keep it low only when the same URL can change its bytes; the docs warn there is no invalidation mechanism, so a long TTL needs URLs that change when content changes (a content-hashed name, or a `?v=` value pinned in `search`). For those, the docs' example of 2678400 (31 days) is a sane ceiling. Static imports (`import hero from './hero.png'`) are hashed and cached as `immutable` automatically, so prefer them for repo-owned images.
- Every width in `deviceSizes` plus `imageSizes`, times each format and each allowed quality, is a separately cached variant (the docs: with several formats "Next.js will cache each format separately"). AVIF encodes about 50% slower and compresses about 20% smaller than WebP (the docs' figures). Keep both formats for a content site; use `['image/webp']` on a small single-instance host. Trim both size lists to the breakpoints your layout uses.
- Component usage that the config cannot enforce: give every image `width` and `height` (or `fill` inside a positioned parent) so the layout does not shift; give every image narrower than the viewport a `sizes` prop (without it the browser assumes `100vw`); mark only the one largest-contentful image with `preload` (or `fetchPriority="high"`). `priority` is deprecated in this major.

### 6c. A CDN or edge cache in front of the origin

**Trigger:** traffic where origin load or latency matters, or a platform that puts a CDN in front by default. Defaults first: put the CDN **in front of the same hostname** and change nothing in the app. Reasons: it needs no CSP source, no CORP change and no `assetPrefix`.

What the CDN has to do (CDN caching guide):

- Respect `Cache-Control` as sent. `/_next/static/` is `public, max-age=31536000, immutable`; a static page is `s-maxage=31536000`; an ISR page is `s-maxage={revalidate}, stale-while-revalidate={expire - revalidate}`. Here `/[locale]` revalidates every 3600 s and `/[locale]/example-form` every 1800 s (`revalidate` exports in the two page files); dynamic responses are `private, no-cache, no-store`, which a correct CDN will not store.
- Forward the `rsc` request header, and keep query strings (the `_rsc` parameter) in the cache key. The guide says that if the CDN strips `rsc`, the server returns HTML where the client router expects an RSC payload and navigation turns into full page loads.
- Run `proxy.ts` **before** the cache, or bypass caching for routes whose result depends on it. Here that covers `/api/*` (rate limit, nonce CSP) and, once there are two or more locales, the redirect from `/`, whose target next-intl derives from the `accept-language` header and the `NEXT_LOCALE` cookie (its locale-detection docs; the CDN-key consequence is **inference**). The guide says the proxy "should run before the CDN cache so it remains the source of truth".
- On-demand revalidation does not reach the CDN. `revalidateTag` and `revalidatePath` clear the Next.js cache only; the guide's pattern is to call the CDN purge API right after them, covering both the HTML and the RSC variants of each path. Phase 1b's tag invalidation (`updateTag` or `revalidateTag` after a write) is where that call belongs.
- Trust the forwarded client address correctly: set `RATE_LIMIT_TRUST_PROXY` to match the CDN (Phase 7), otherwise every client shares the CDN's address and the 100-per-minute limit trips for everyone at once.

**Only if assets must come from a separate origin** (`assetPrefix` set to a CDN host in production): it prefixes `/_next/static` only, never `public/` files and never `/_next/data`, so `public/` assets need manual prefixing (the `assetPrefix` page). Then two repo-owned settings break unless changed together:

- `script-src`, `style-src` and `font-src` in `shared/lib/cspHeader.ts` list only `'self'` (and `'unsafe-inline'` / `data:` where shown); add the CDN origin to each, in both the static and the nonce builders, and extend `shared/lib/cspHeader.test.ts`. Behaviour of CSP source lists is **training data**, not read from a Next.js page this session.
- `next.config.ts` sends `Cross-Origin-Resource-Policy: same-origin` on `/:path*`, and `next.config.test.ts` asserts that one rule. A cross-origin `<script>` load without a CORS opt-in is expected to be refused under that header (**inference** from the CORP spec, not read this session). Give `/_next/static/:path*` its own rule with `same-site` or `cross-origin`, update that test deliberately, and check the result with `curl -I` on a real asset URL before trusting it.

**Security:** an image optimizer is a fetch-and-transform endpoint, so the allowlist (6a) is the control; never put a user-supplied host into `remotePatterns`. Do not cache responses that carry `Set-Cookie` or depend on the session cookie from Phase 2 (configure the CDN to bypass its cache when the session cookie is present).
**Do not:** use `domains`; leave a pattern field out "for convenience"; set a long `minimumCacheTTL` for mutable URLs; add `assetPrefix` just to "use the CDN"; let the CDN cache `/api/*`.

---

## Phase 7 — Deployment hardening

The template ships the application-layer controls and **no host configuration**: no Dockerfile, no reverse-proxy file, no vendor deployment file, and none of the workflows (`ci.yml`, `docs.yml`, `mutation.yml`, `release.yml`, `security.yml`) deploys anything. `npm run build` runs `next build --webpack` and `npm start` runs `next start`. This phase is what changes between "works on my machine" and "survives a real edge". Two repo facts frame it. The production build is **per environment**, because `NEXT_PUBLIC_APP_URL` is inlined at build time (`shared/lib/env.ts` requires it in production and rejects localhost; `scripts/check-build-env.mjs` names the fix). And the push gate starts in phase 0 (scaffold): flipping to phase 1 at the first deploy is one commit in `scripts/gate-tiers.json` (ask-first), and `AGENTS.md` § Commands (exact) › _The tier law_ owns that rule.

Sources: the Next.js self-hosting guide (`self-hosting.mdx`), `output.mdx`, `deploymentId.mdx`, `serverActions.mdx`, `incrementalCacheHandlerPath.mdx` and the data-security guide (`data-security.mdx`), read at the installed tag's docs. Nginx directives, Docker image names and HTTP caching semantics are **training data** unless a source is named.

### Choose one (where the app runs)

| Option                                           | Pros                                                                                 | Cons                                                                                                                            | When to pick                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A platform that runs Next.js for you**         | The client-address header, TLS and a CDN come with it; no image or proxy to maintain | Adapters are platform-specific (the `cacheHandler` page's platform table); the client-address default is wired for one platform | The smallest team, the fastest first deploy             |
| **A Node process behind your own reverse proxy** | Full control of headers, TLS, buffering and limits                                   | You own every item in 7a, 7b and 7f                                                                                             | A VM, or a PaaS that runs a start command               |
| **A container** (7e)                             | One reproducible artifact for any orchestrator                                       | One more build output to copy; an ask-first change to `next.config.ts`                                                          | Kubernetes, a container host, or more than one instance |

More than one instance means 7d, whichever row you pick.

### 7a. Client identity for the rate limiter

**Trigger:** every first deploy. `NextRequest.ip` is always `undefined` in Next 16 (a comment in `shared/lib/middlewareRequest.ts` says so), so the limiter derives a client key from request headers, and which header deserves belief depends on what sits in front of the app. `RATE_LIMIT_TRUST_PROXY` selects the rule (`README.md` and `.env.example` list it):

| Mode        | Key                                                                              | Safe when                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel`    | `x-vercel-forwarded-for`, then the socket address, then one shared anonymous key | That platform header is the only way in. The default only when the variable is unset and `VERCEL` is `1`                                        |
| `first-hop` | The leftmost `x-forwarded-for` entry, taken as-is                                | The outermost proxy **overwrites** the header with the address it saw. If it appends to a client-supplied value, the client chooses its own key |
| `none`      | The first 64 characters of `User-Agent`                                          | Always safe, never fair: every browser with the same User-Agent string shares one bucket of 100 requests per 60 s. The default everywhere else  |

Both `none` and `first-hop` print a one-time production `console.warn`; read it as a prompt to verify the edge, not as noise to silence.

**What to wire:**

- Behind your own proxy, make it **overwrite** the header, not append: in nginx that is `proxy_set_header X-Forwarded-For $remote_addr;` (**training data**), then set `RATE_LIMIT_TRUST_PROXY=first-hop`. Behind a CDN plus a proxy, read the CDN's documentation for the header it overwrites and pass that one value on as the only `X-Forwarded-For` entry (**opinion**: a chain the client can prepend to is a key the client chooses).
- Make the origin reachable only through the proxy or the CDN (a firewall or security-group rule; **opinion**). Otherwise a client skips the proxy and sends whatever header it likes.
- Set the variable in the runtime environment of the running process: server-only, never a `NEXT_PUBLIC_` name. Redeploy after changing it (**unverified** whether a restart alone is enough).

**Guard:** `shared/lib/middlewareRequest.test.ts` and `proxy.test.ts` already cover the modes and the 429 on `/api/health`. What no unit test can cover is the real edge. After the first deploy, send more than 100 requests inside one minute to `/api/health` from one machine, each with a different forged `X-Forwarded-For` value. A correct `first-hop` or `vercel` setup answers 429 (the edge replaced the forgery, so every request shares one key). All 200s means the forged values reached the app (**inference** from the keying code), so the mode or the proxy is wrong. The run throttles you for the rest of that minute, so use a throwaway shell.

**Security:** the key is the only thing between "100 per minute per client" and "no limit at all". **Do not:** set `first-hop` to silence the warning; raise the limit to cure a shared-address problem (fix the key instead); add a branch before the limiter in `proxy.ts` (the `AGENTS.md` invariant).

### 7b. Origin checks behind a proxy (Server Actions and route handlers)

**Trigger:** the first deploy where the browser's host differs from the host the Node process sees: any proxy, load balancer or CDN that rewrites `Host`. Two independent checks are involved.

**Server Actions** (`serverActions.mdx`, and the CSRF part of `data-security.mdx`): Next compares the request `Origin` with the `Host` or `x-forwarded-host` header, in production too. `allowedOrigins` takes **hosts**, not URLs (the host of the `Origin` header, port included when present). `*` matches one label, `**` matches one or more and only at the start, and no entry is needed when the proxy forwards the public host in `x-forwarded-host`. A request with no `Origin` is allowed with a warning. The template's current entry is `allowedOrigins: [appOrigin]` in `next.config.ts`, where `appOrigin` is the full `NEXT_PUBLIC_APP_URL` (scheme included), which does not have the host shape the docs describe: the entry is probably inert (**inference** from "entries are hosts"; not run). If the entry is inert, the check passes only through the `Host` / `x-forwarded-host` comparison, which is why the proxy is the first thing to fix.

**What to wire:**

- First choice: make the proxy forward the public host in `x-forwarded-host` (or leave `Host` untouched). Then no config change is needed.
- If you cannot, replace the entry with the host of the public origin, derived from the constant already in the file (`next.config.ts` is ask-first):

```ts
experimental: {
    serverActions: {
        allowedOrigins: [new URL(appOrigin).host],
        bodySizeLimit: '1mb'
    }
}
```

- Preview or per-branch hosts: a wildcard such as `**.preview.example.com` (one or more labels, at the start only), never a bare `**`.
- `bodySizeLimit` defaults to 1 MB and applies to the raw body; a multipart upload needs 10-20 KB of slack on top. The proxy's own body cap (nginx `client_max_body_size`, **training data**) must be at least as large, otherwise the proxy answers 413 before the app can return its typed error.

**Route handlers** (`app/api/vitals/route.ts`, `app/api/example-form/route.ts`, `app/api/csp-report/route.ts`) call `requireSameOrigin` from `shared/lib/requireSameOrigin.ts`. It accepts a mutating request only when `Origin` equals the origin of `NEXT_PUBLIC_APP_URL` or the origin built from the request's own `Host` header. It deliberately ignores `X-Forwarded-Host`, because a client can set that header and a test asserts the forged request still gets 403. Consequence: behind a proxy that rewrites `Host`, only the configured branch can match, so `NEXT_PUBLIC_APP_URL` has to be the exact public origin the browser uses (scheme, host, port; `www` and the bare domain are different origins). Whether the serving-origin branch sees `https` behind a TLS-terminating proxy is **unverified**, which is one more reason the configured branch must carry production.

**Guard:** after the first deploy, from outside the network: `curl -i -X POST https://<public-host>/api/example-form -H 'Origin: https://evil.example'` must answer 403, and the same request with `-H 'Origin: https://<public-host>'` must get past the origin check (the response is then the route's own, not 403). Run one real Server Action from the browser as well; a mismatch shows up as a failed action with an origin message in the server log.

**Security:** an `allowedOrigins` entry lets that host invoke your Server Actions cross-origin, so list only hosts you own (**opinion**). The route-handler check trusts the request's `Host` as one accepted origin (the file's own comment); so make the proxy reject requests whose `Host` is not one you serve. **Do not:** add `localhost` to a production list; trust `x-forwarded-host` inside a route handler; remove the check to make a proxy "work".

### 7c. One build per environment (URL, build identity, staging)

**Trigger:** a second environment (staging next to production) or rolling deploys.

**What to wire:**

- **Build once per environment, never promote.** `NEXT_PUBLIC_*` is inlined at build (`self-hosting.mdx`), and `NEXT_PUBLIC_APP_URL` reaches the canonical URLs, hreflang entries, `app/sitemap.ts` and `app/robots.ts` through `getAppBaseUrl()` in `shared/lib/env.ts`. A staging artifact promoted to production would publish staging URLs. Server-only variables are different: they are read when the process runs. Build in CI with that environment's value; do not satisfy `scripts/check-build-env.mjs` with a localhost value (`env.ts` rejects it for a reason). The `.invalid` value in `.env.example` and `ci.yml` passes `check-build-env.mjs` (it rejects only a missing, malformed or localhost value) but bakes a fake origin, so a deployed build needs the real one. A host that assigns its address only at the first deploy has no real origin to inline yet, so that deploy needs two builds: the first to learn the host, the second with the real value (**inference** from the inlining at build; attaching the custom domain before the first deploy needs one build). The `README.md` deployment step "update `app/sitemap.ts` and `app/robots.ts` URLs" is stale: both files take the URL from `NEXT_PUBLIC_APP_URL` (verified in `app/robots.ts`).
- **Build identity for rolling deploys.** Set `NEXT_DEPLOYMENT_ID` to the commit SHA on the build command: `NEXT_DEPLOYMENT_ID=$GIT_SHA npm run build` (`deploymentId.mdx`: the config key or the variable; the config key wins when both exist). Next then appends `?dpl=<id>` to static asset URLs, sends `x-deployment-id` and `x-nextjs-deployment-id`, writes `data-dpl-id` on `<html>` and mixes the id into `'use cache'` keys; a client that sees a different id does a hard navigation instead of a client-side one. The variable form needs no edit of `next.config.ts` (ask-first).
- **Know what it does not do.** Next does not route on `?dpl=`; a per-deployment id avoids skew only when your host or CDN routes requests by deployment. Without that, a client that lands on an instance from the other deployment reloads rather than navigates. Keep the previous build's `/_next/static` files reachable for the length of the rollout (**inference**: an already-loaded page still requests its own hashed files).
- **Build once, copy the artifact to every instance.** The guide's `generateBuildId` section exists for hosts that build on each instance, and it has no effect when `deploymentId` is set.
- **A staging build is indexable by default.** `app/robots.ts` blocks crawling only when `NODE_ENV` is not `production`, and `next build` runs as production for every environment (**training data**; check the environment variables guide). Protect staging at the edge (an auth or IP allowlist; **opinion**), or send `X-Robots-Tag: noindex` from the proxy for staging hosts. Do not edit `app/robots.ts` for this: it is the production SEO surface.

**Guard:** after each deploy, `curl -s https://<public-host>/en | grep -o 'data-dpl-id="[^"]*"'` must print the SHA you built (`deploymentId.mdx` names the attribute; **unverified** against this repo's wrapped config, not run). A missing attribute means the variable did not reach the build.

**Security:** `NEXT_PUBLIC_` is a publication, not configuration; never put a secret behind that prefix. **Do not:** ship one artifact to two environments; reuse the production `NEXT_PUBLIC_APP_URL` in staging to "make the check pass".

### 7d. More than one instance (state that is per-process by default)

**Trigger:** two or more instances, pods or servers, or autoscaling. Three things are per-process unless you change them.

**What to wire:**

- **Rate-limit counters.** Without `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` the limiter falls back to an in-memory counter per process (`AGENTS.md`, `proxy.ts`), so N instances allow N times the limit and every deploy resets it. Set both variables on every instance (`@upstash/ratelimit` 2.2.0 and `@upstash/redis` 1.39.0 are installed). Store them as secrets, never `NEXT_PUBLIC_`.
- **The Server Actions encryption key** (`self-hosting.mdx`, `data-security.mdx` § "Overwriting encryption keys"). Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to the same base64 value (16, 24 or 32 bytes) at build time, otherwise a multi-server deploy can fail with "Failed to find Server Action". Generate it once with `openssl rand -base64 32` (**training data**) and keep it in the secret store that feeds the build.
- **The ISR and data cache.** It lives on local disk by default (an in-memory part of 50 MB plus the disk), so every pod holds its own copy: `/[locale]` (revalidated every 3600 s) and `/[locale]/example-form` (1800 s) regenerate independently per pod, and a `revalidateTag` or `revalidatePath` from Phase 1b reaches only the pod that ran it. To share it, point `cacheHandler` at a handler backed by a shared store and set `cacheMaxMemorySize: 0` (`incrementalCacheHandlerPath.mdx`). The handler implements `get`, `set`, `revalidateTag` and `resetRequestCache`; it must preserve keys exactly as given (they are opaque, not pathnames); `revalidatePath` calls your `revalidateTag`. Resolve the path to an absolute one the way the config already does for `outputFileTracingRoot` (the doc sample uses `require.resolve`; **unverified** in this repo's TypeScript config). The handler body belongs to your store; start from the example in the guide's "Configuring Caching" section.
- **`cacheHandler` is not `cacheHandlers`.** The singular key serves ISR, route handler responses and, since v16.2.0 behind `images.customCacheHandler: true`, optimized images. It does **not** serve `'use cache'` (the plural `cacheHandlers` does, and its `refreshTags()` coordinates tags across instances). The template uses no `'use cache'` (checked with a grep of `app`, `features`, `shared`), so only the singular key matters until you add one. Whether the singular handler needs coordination beyond a shared store is **unverified**.

**Guard:** for the handler, a unit test against a fake store: a value written with `set` comes back from `get` under the same key; `revalidateTag` removes every entry carrying that tag; a key is stored and returned byte for byte. For the limiter, the 7a check, run again with two instances behind the balancer: the 429 must arrive after about 100 requests in total, not 100 per instance.

**Security:** the shared cache holds rendered pages, so it must be reachable only from the app, over TLS, with its credential in a secret store. Pages that depend on the Phase 2 session cookie are dynamic and do not enter the ISR store (**inference**); keep it that way. **Do not:** give each pod a different encryption key; leave the in-memory limiter on in production with more than one instance; build once per instance with different build ids.

### 7e. A container image (standalone output)

**Trigger:** the host takes an image. Standalone output only pays off here (**opinion**); a plain Node host can run `next start`.

**What to wire:**

- `output: 'standalone'` in `next.config.ts` (ask-first). `next build` then writes `.next/standalone` with a minimal `server.js` and only the traced `node_modules` (`output.mdx`). The config already sets `outputFileTracingRoot` to the repo root, which is the monorepo caveat the page names, and it already excludes the dev-only `/dev/**` routes from the production trace, so the dev fixtures stay out of the image. It keeps `distDir` at `.next` unless `NEXT_DIST_DIR` is set, so leave that variable unset in the image build.
- The minimal server does not copy `public` or `.next/static`; the page gives the command `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/`, and says a CDN should ideally serve them (Phase 6c).
- Start it with `node .next/standalone/server.js`; `PORT` and `HOSTNAME` are read (the page's example is `PORT=8080 HOSTNAME=0.0.0.0`). Listen on `0.0.0.0` inside a container, or nothing outside reaches it (**inference**).
- A multi-stage `Dockerfile` (fork-created; base image and user name are **training data**):

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_DEPLOYMENT_ID
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

- Copy `.npmrc` before `npm ci`, as above: it disables lifecycle scripts as a supply-chain guard (`AGENTS.md`), so the `prepare` hook (husky) does not run in the image either. Pass the two build arguments from CI (7c). A build argument is visible in the image history (**training data**), so pass `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (7d) as a BuildKit secret mount instead of an `ARG`.
- An orchestrator may set `HOSTNAME` itself (Kubernetes sets it to the pod name; **training data**), which would override the image's `ENV`. Check the listen address in the first container log line, and set `HOSTNAME=0.0.0.0` in the run configuration if it differs.
- A `.dockerignore` that excludes `.git`, `node_modules`, `.next` and every `.env*` file, so no secret is copied in by `COPY . .`.
- The exec-form `CMD` makes `node` the process that receives `SIGTERM` (**inference**; a shell wrapper would not forward it). The self-hosting guide says `after()` works with `next start` when the process gets `SIGINT` or `SIGTERM` and is given 10-30 s to drain; whether the standalone `server.js` behaves the same is **unverified**. Set the orchestrator's termination grace period to 30 s, the top of that range (**opinion**).
- Probe `/api/health` on the container port directly. It is an edge-runtime route that returns `{ status: 'ok', timestamp }` with no dependency check, which is what a liveness probe wants (**opinion**: keep it that way).

**Pitfall:** the gate's production end-to-end lane starts `next start` (`PLAYWRIGHT_PROD_SERVER=1`). Whether `next start` still works once `output` is `standalone` is **unverified** (a canary-source reading said it warns). After the change, run one production-mode spec through the measure moment (`npm run verify:measure -- e2e/health.spec.ts`), not the full gate; if `next start` refuses, point that lane at `node .next/standalone/server.js`, after the static copy above.

**Guard:** extend `next.config.test.ts` to assert `output: 'standalone'`, and, if you want the image itself checked in CI, one workflow job that builds it and curls `/api/health` (`.github/workflows/` is ask-first).

**Security:** run as a non-root user, keep `.env*` out of the context, and never print the build arguments in CI logs. **Do not:** copy `node_modules` into the runtime stage "to be safe" (it defeats the trace); bake runtime secrets into the image; run `next dev` in a container that faces traffic.

### 7f. The reverse proxy and edge layer

**Trigger:** anything between the browser and the Node process. The self-hosting guide recommends a reverse proxy for malformed requests, slow connections, payload size limits and rate limiting, none of which `next start` does for you.

**What to wire:**

- **TLS and HSTS.** Terminate TLS at the proxy and redirect HTTP to HTTPS. The app already sends production HSTS (`max-age=31536000; includeSubDomains; preload`, `next.config.ts` lines 51-56), so do not add a second `Strict-Transport-Security` at the proxy: one home. `includeSubDomains` commits every subdomain to HTTPS, and joining the browsers' preload list is a separate manual step that is hard to undo (**training data**); `README.md` carries the preload note.
- **Streaming.** A proxy that buffers responses delivers a streamed page all at once. Per the guide, nginx needs `X-Accel-Buffering: no` and a balancer must support chunked transfer. Set the header in `next.config.ts` (ask-first) or switch buffering off for the app location at the proxy (**training data**).
- **Pass the right headers on:** `Host` unchanged (or the public host in `x-forwarded-host`, 7b), `X-Forwarded-For` as one overwritten value (7a), and `X-Forwarded-Proto`. Do not strip or duplicate `Content-Security-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` or `Reporting-Endpoints`. Your CDN rules from Phase 6c still apply.
- **`/api/health` through a CDN.** The route sends `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`, and it is rate limited like every `/api/` path (`proxy.test.ts` proves the 429). A probe that goes through a CDN can see a stale answer for tens of seconds (standard HTTP caching semantics), and an external monitor on shared infrastructure can share a limiter bucket. Probe the container directly for liveness; point an external monitor at a path you do not need to protect, at a modest interval.
- **Timeouts.** The proxy's read timeout has to exceed the slowest streamed response; its header and body timeouts are your slow-client defence (**opinion**).
- **Headers after each deploy.** `SECURITY_REQUIREMENTS.md` § Pre-deployment checklist is the list to run (header presence with `curl -I`, third-party origins, no token in storage, the scanner). Do not copy it here.

**Guard (the open item in `SECURITY_REQUIREMENTS.md`: a production assertion on the CSP header does not exist yet).** The static production policy is built by `buildStaticContentSecurityPolicy` in `shared/lib/cspHeader.ts`, which has no alias imports, so a spec can import it by a relative path and compare the served header with it. A new browser test is justified here because it measures an invariant no existing spec measures (`AGENTS.md`, "What earns a browser test"); the suite's ceiling lives in `scripts/gate-tiers.json`, so a new spec moves it only with a measurement and a `DECISIONS.md` line. Sketch (fork-created file, not run, **unverified**; the file-level `test.skip(callback, description)` form is the one the Playwright `Test.skip` reference documents, and `e2e/forced-colors.spec.ts` uses it inside a `describe`):

```ts
// e2e/headers.spec.ts
import { expect, test } from '@playwright/test';

import { buildStaticContentSecurityPolicy } from '../shared/lib/cspHeader';

test.skip(() => !process.env.PLAYWRIGHT_PROD_SERVER, 'production headers only');

test('the served CSP is the production policy', async ({ request }) => {
    const res = await request.get('/en');
    expect(res.headers()['content-security-policy']).toBe(buildStaticContentSecurityPolicy(false));
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['strict-transport-security']).toContain('max-age=31536000');
});
```

Run it with `npm run verify:measure -- e2e/headers.spec.ts` while writing it. The test proves the app's header; the post-deploy `curl -I` proves the edge did not rewrite it.

**Security:** the proxy is the first place a malformed or hostile request lands, so it owns size caps, timeouts and the unknown-`Host` rejection from 7b. **Do not:** terminate TLS in the app; let a CDN cache `/api/*` (Phase 6c); open the Node port to the internet next to the proxy.

### Intentionally NOT recommended

Each line names the rejected default and the one phase that owns the reason; nothing is argued twice.

- **Tokens in `localStorage` or `sessionStorage`.** Any script on the page can read them; the rule is in `SECURITY_REQUIREMENTS.md`, the cookie-based alternatives are Phase 2.
- **TanStack Query as the default data layer.** It was removed because nothing used it; add it only for a client island that truly needs it (Phase 1d).
- **`images.domains`.** Use `remotePatterns` with every field pinned (Phase 6a).
- **An analytics or advertising script before consent.** The template's `AGENTS.md` lists vendors as out of scope; the consent-aware mount is Phase 4a.
- **`output: 'export'`.** A static export has no server, so the proxy, the rate limiter, the nonce CSP and Server Actions would not run (**training data**); `incrementalCacheHandlerPath.mdx` lists static export as unsupported for a custom `cacheHandler` (Phase 7d).
- **`RATE_LIMIT_TRUST_PROXY=first-hop` without a verified overwrite at the edge** (Phase 7a), and **a catch-all `allowedOrigins` or trusting `x-forwarded-host` in a handler** (Phase 7b).
- **Widening the CSP with `*`, `'unsafe-eval'` or a vendor host "to make it work".** Add the one origin the vendor documents, in the phase that needs it (Phases 3b, 4b, 6c).
- **Reordering `proxy.ts` or putting a branch before the rate limiter.** The order and its reason are in `.cursor/brain/SKELETONS.md` and `AGENTS.md` § Architecture and contracts.
- **A secret behind a `NEXT_PUBLIC_` name.** The prefix publishes the value into the bundle (Phase 7c).

## Cross-references — what to update when graduating

When you graduate a phase, update these in the same pull request, so the brain does not drift from the code. Decide the order by the thing you changed: the code and its test first, then the pointers.

- `README.md`: the Environment Variables and Deployment sections, for each new variable or host step.
- `.env.example`, `shared/lib/env.ts` (public variables) and the server-only env module from Phase 1a: every new variable with its validation. A server-only variable never gets a `NEXT_PUBLIC_` name.
- `SECURITY_REQUIREMENTS.md`: the session, token and header statements the phase changes (for example, line 19 says the app never reads the session token, which the self-managed option in Phase 2 contradicts).
- `.cursor/brain/SKELETONS.md`: a new danger zone when the phase introduces one (a monitoring init above the error boundary, an auth check placed before the rate limiter).
- `.cursor/brain/DECISIONS.md`: one short entry per adopted phase (context, decision, consequences), with the option you chose from its table and why.
- `.cursor/brain/MAP.md`, `.cursor/brain/PROJECT_CONTEXT.md` and `.cursor/brain/READING_INDEX.md`: the new files, the stack row and the situation entry.
- `AGENTS.md`: the "Out of scope" list when an item on it becomes in scope (analytics vendors, locales), and the stack line when a major dependency arrives.
- `scripts/gate-tiers.json`: the `phase` flip at the first deploy and, after a measurement, the browser-suite ceiling. Both are ask-first, and `AGENTS.md` § Commands (exact) › _The tier law_ owns the rules.
- `.claude/settings.json` and `.github/workflows/`: every edit there is ask-first; a new deploy or image job lives in a workflow, never only in a script.

If a phase introduces a recurring class of failure, add it to `.cursor/brain/SKELETONS.md` as well, and add the guard to the gate rather than to a reminder.

---

## When NOT to use this checklist

- **A throwaway prototype.** Skip every phase; ship it and delete it.
- **A site with no backend of its own** (content from files, a form that posts to a third party). Skip Phases 1 and 2.
- **An internal tool behind a corporate gateway.** The gateway already owns identity, so take the "backend owns the session" or the hosted-provider row in Phase 2 instead of building one.
- **A single-language product that will stay that way.** Skip Phase 5; the `lang` attribute and the locale list are already correct for one locale.
- **A host that does everything for you.** Read Phase 7's table first; on a platform that runs Next.js, only 7a, 7b and 7c are yours.

The template is opinionated; this checklist is a menu, not a mandate.
