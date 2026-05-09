/**
 * Edge-safe helpers shared with root `proxy.ts` (rate-limit identity + static asset skip).
 *
 * Rate-limit identity caveat: Next.js 14+ removed `NextRequest.ip` (always
 * `undefined` in Next 16). IP must be read from forwarded headers — the trust
 * mode dictates which header is authoritative. `none` mode is anonymous-by-design
 * (User-Agent only) — see `emitModeWarningOnce` below for the runtime nudge.
 */

export type RequestHeadersLike = {
    get(name: string): string | null;
};

/** Minimal request shape for rate-limit identity (NextRequest satisfies this). */
export type RateLimitRequestLike = {
    headers: RequestHeadersLike;
    /**
     * Platform client IP when available — kept for tests / non-Next runtimes.
     * `NextRequest.ip` was removed in Next 14+; in Next 16 this is always
     * undefined and the trust mode + headers are authoritative.
     */
    ip?: string | null;
};

export type TrustedProxyMode = 'vercel' | 'first-hop' | 'none';

export function resolveTrustedProxyMode(): TrustedProxyMode {
    const raw = process.env.RATE_LIMIT_TRUST_PROXY?.trim().toLowerCase();
    if (raw === 'vercel' || raw === 'first-hop' || raw === 'none') {
        return raw;
    }
    return process.env.VERCEL === '1' ? 'vercel' : 'none';
}

let modeWarningEmitted = false;
/**
 * One-time runtime warning when running with anonymous-only rate limit
 * (no IP trust). Surfaces what would otherwise be a silent security
 * degradation on non-Vercel hosts that didn't set RATE_LIMIT_TRUST_PROXY.
 */
function emitModeWarningOnce(mode: TrustedProxyMode): void {
    if (modeWarningEmitted) return;
    modeWarningEmitted = true;
    if (mode === 'none' && process.env.VERCEL !== '1' && process.env.NODE_ENV === 'production') {
        // Lazy import — keeps middlewareRequest edge-safe (logger uses console only).
        // eslint-disable-next-line no-console -- intentional one-time prod warning to surface silent degradation
        console.warn(
            '[rate-limit] Running in `none` trust mode: rate-limit identity is User-Agent only, NOT IP. ' +
                'Trivial to bypass by rotating UA. Set RATE_LIMIT_TRUST_PROXY=first-hop (behind nginx / Cloudflare / docker) ' +
                'or rely on automatic detection on Vercel (VERCEL=1). See .env.example.'
        );
    }
}

function anonKey(headers: RequestHeadersLike): string {
    return `anon:${headers.get('user-agent')?.slice(0, 64) ?? 'na'}`;
}

export function getRateLimitKey(request: RateLimitRequestLike): string {
    const mode = resolveTrustedProxyMode();
    emitModeWarningOnce(mode);
    const { headers } = request;
    const socketIp = request.ip?.trim() || null;

    if (mode === 'vercel') {
        const vercel = headers.get('x-vercel-forwarded-for');
        const ip = vercel?.split(',')[0]?.trim() || socketIp;
        return ip ? `ip:${ip}` : anonKey(headers);
    }

    if (mode === 'first-hop') {
        const xff = headers.get('x-forwarded-for');
        if (xff) {
            const first = xff.split(',')[0]?.trim();
            if (first) {
                return `ip:${first}`;
            }
        }
        if (socketIp) {
            return `ip:${socketIp}`;
        }
        return anonKey(headers);
    }

    if (socketIp) {
        return `ip:${socketIp}`;
    }
    return anonKey(headers);
}

export function isAssetPath(pathname: string): boolean {
    return (
        pathname.startsWith('/_next/static') ||
        pathname.startsWith('/_next/image') ||
        /\.(css|js|woff|woff2|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|ico|avif)$/i.test(pathname)
    );
}
