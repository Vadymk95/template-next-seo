# Security Requirements — template-next-seo

Unlike the static templates, this app sets its own headers: **the security headers and the Content Security Policy live in code**, not on a CDN.

## Where it is

| Concern                                | Home                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Security headers, incl. the static CSP | `next.config.ts` → `headers()`                                            |
| CSP string                             | `shared/lib/cspHeader.ts` (`buildStaticContentSecurityPolicy(isDev)`)     |
| CSP violation reports                  | the endpoint named by `CSP_REPORTING_ENDPOINT_NAME` in `shared/constants` |
| Request-time work (nonce, redirects)   | `proxy.ts`                                                                |
| Core Web Vitals in production          | `app/WebVitalsReporter.tsx` (`useReportWebVitals`: LCP, CLS, INP)         |

Change the header set only in those files; a header added anywhere else is a second source of truth.

## 🔑 Session, tokens and money

- **The session token lives in an `HttpOnly; Secure; SameSite=Lax` cookie set by the server.** The app never reads it and never stores it: no `localStorage`, no `sessionStorage`, no in-memory copy handed around. Identity comes from an endpoint (`GET /me`-shaped), never from parsing a cookie.
- **Across apps the cookie is the contract, not a store.** When this app runs under a path of a larger product (one reverse proxy, `/app/*` per app), the cookie scope (`Domain`, `Path`) is all that is shared. No common Redux/Zustand store across apps; cross-app signals go through a versioned `CustomEvent` on `window`.
- **Thin client, no client-side pricing.** The client never computes, corrects or submits a price, discount or total it derived itself; it sends an intent or an id and renders what the server returns. Money is validated on the server; the boundary adapter (`.cursor/rules/api.mdc`) parses the response once.
- **Third-party scripts** (payments, analytics) load only from origins listed in the CSP, never with `'unsafe-inline'`.

## ✅ Pre-deployment checklist

- [ ] `curl -I` on the deployed origin shows `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- [ ] The CSP has no `'unsafe-inline'` for scripts in production (`isDev` off)
- [ ] Every third-party origin the app loads is listed in the CSP; the violation endpoint receives reports
- [ ] `X-XSS-Protection` is **not** set (deprecated)
- [ ] No token in `localStorage` / `sessionStorage`; no price arithmetic in the client
- [ ] Headers scanned once with [Security Headers Scanner](https://securityheaders.com/)

Open item, with its trigger: a production e2e assertion on the CSP header does not exist yet; add it the first time the header set changes after the first deploy.
