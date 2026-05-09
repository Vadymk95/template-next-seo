/**
 * Content-Security-Policy helpers: static policy via next.config headers, and
 * nonce-based policy for proxy-handled routes (API / dev).
 */

export const CSP_NONCE_HEADER = 'x-nonce';

function baseCspDirectives(scriptSrc: string, isDevelopment: boolean): string[] {
    const directives: string[] = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        // Next/font and Tailwind may emit inline style tags
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        // `connect-src 'self'` only by default — restrictive baseline. Forks add
        // explicit external origins (analytics endpoint, Sentry DSN, Stripe, etc.)
        // here when wiring those vendors. Previous `'self' https:` allowed XHR /
        // fetch / WebSocket to ANY https host — exfil surface for compromised JS.
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        'report-to csp-endpoint'
    ];

    if (!isDevelopment) {
        directives.push('upgrade-insecure-requests');
    }

    return directives;
}

/**
 * CSP for ISR/static pages (no per-request nonce).
 *
 * Production allows `'unsafe-inline'` for script-src — required by Next 16 RSC
 * bootstrap scripts (`<script>self.__next_f.push(...)>`) which are emitted
 * inline into prerendered HTML at BUILD time. Per-request nonce CSP cannot
 * cover them: ISR HTML is cached, and a request-time nonce in the header
 * never reaches the cached `<script>` tags — CSP would block hydration.
 *
 * Per Next.js CSP docs ("Nonces only support dynamic routes"), the correct
 * pattern for static + ISR routes is hash-based CSP. That is impractical for
 * a multi-page app because the `__next_f.push` payload differs per page →
 * infinite hashes. `'unsafe-inline'` is the documented escape hatch and the
 * default Next.js production deployments rely on. Other directives stay tight
 * (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, ...) so
 * the XSS surface is constrained even with inline scripts allowed.
 *
 * For dynamic routes (`/api/*`, `/dev/*`) `proxy.ts` overrides this with
 * `buildContentSecurityPolicy(nonce)` which uses `'strict-dynamic' + nonce`
 * — strictest setting for the routes that can support it.
 */
export function buildStaticContentSecurityPolicy(isDevelopment: boolean): string {
    const scriptSrc = isDevelopment
        ? "'self' 'unsafe-eval' 'unsafe-inline'"
        : "'self' 'unsafe-inline'";
    return baseCspDirectives(scriptSrc, isDevelopment).join('; ');
}

export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
    const scriptSrc = isDevelopment
        ? "'self' 'unsafe-eval' 'unsafe-inline'"
        : `'strict-dynamic' 'nonce-${nonce}'`;
    return baseCspDirectives(scriptSrc, isDevelopment).join('; ');
}
