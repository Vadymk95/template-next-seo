/**
 * Edge-safe helpers shared with root `proxy.ts` (rate-limit identity + static asset skip).
 */

export type RequestHeadersLike = {
    get(name: string): string | null;
};

/** Minimal request shape for rate-limit identity (NextRequest satisfies this). */
export type RateLimitRequestLike = {
    headers: RequestHeadersLike;
    /** Platform client IP when available (e.g. NextRequest.ip). */
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

function anonKey(headers: RequestHeadersLike): string {
    return `anon:${headers.get('user-agent')?.slice(0, 64) ?? 'na'}`;
}

export function getRateLimitKey(request: RateLimitRequestLike): string {
    const mode = resolveTrustedProxyMode();
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
