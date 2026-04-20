/**
 * Edge-safe helpers shared with root `proxy.ts` (rate-limit identity + static asset skip).
 */

export type RequestHeadersLike = {
    get(name: string): string | null;
};

export function getRateLimitKey(headers: RequestHeadersLike): string {
    const vercel = headers.get('x-vercel-forwarded-for');
    const xff = headers.get('x-forwarded-for');
    const real = headers.get('x-real-ip');
    const ip =
        vercel?.split(',')[0]?.trim() ?? xff?.split(',').at(-1)?.trim() ?? real?.trim() ?? null;
    return ip ? `ip:${ip}` : `anon:${headers.get('user-agent')?.slice(0, 64) ?? 'na'}`;
}

export function isAssetPath(pathname: string): boolean {
    return (
        pathname.startsWith('/_next/static') ||
        pathname.startsWith('/_next/image') ||
        /\.(css|js|woff|woff2|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|ico|avif)$/i.test(pathname)
    );
}
