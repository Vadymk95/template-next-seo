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
        "connect-src 'self' https:",
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
 * CSP for ISR/static pages (no per-request nonce). Production uses script-src 'self' only:
 * adding 'strict-dynamic' without a bootstrap nonce/hash would ignore host sources and break
 * Next.js script tags. style-src keeps 'unsafe-inline' for Tailwind / next/font.
 */
export function buildStaticContentSecurityPolicy(isDevelopment: boolean): string {
    const scriptSrc = isDevelopment ? "'self' 'unsafe-eval' 'unsafe-inline'" : "'self'";
    return baseCspDirectives(scriptSrc, isDevelopment).join('; ');
}

export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
    const scriptSrc = isDevelopment
        ? "'self' 'unsafe-eval' 'unsafe-inline'"
        : `'strict-dynamic' 'nonce-${nonce}'`;
    return baseCspDirectives(scriptSrc, isDevelopment).join('; ');
}
