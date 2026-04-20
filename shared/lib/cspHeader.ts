/**
 * Content-Security-Policy for App Router + middleware-injected nonce.
 * Development keeps relaxed script-src for HMR; production uses strict-dynamic + per-request nonce.
 */

export const CSP_NONCE_HEADER = 'x-nonce';

export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
    const scriptSrc = isDevelopment
        ? "'self' 'unsafe-eval' 'unsafe-inline'"
        : `'strict-dynamic' 'nonce-${nonce}'`;

    const directives: string[] = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        // Next/font and RSC may emit inline style tags
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

    return directives.join('; ');
}
