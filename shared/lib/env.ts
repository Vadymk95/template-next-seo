import { z } from 'zod';

/**
 * Public env schema — strict in production to prevent silent SEO disasters.
 *
 * NEXT_PUBLIC_APP_URL drives `metadataBase`, sitemap.xml URLs, robots.txt
 * `sitemap:` line, and `hreflang` alternates. If unset in production, the
 * dev-friendly `http://localhost:3000` default would bake into prerendered
 * HTML and ship to crawlers. In production we therefore require the env var
 * AND reject localhost values. Dev keeps the convenient default.
 */
const isProduction = process.env.NODE_ENV === 'production';

const publicEnvSchema = z.object({
    NEXT_PUBLIC_APP_URL: isProduction
        ? z
              .string({
                  error: 'NEXT_PUBLIC_APP_URL is required in production (drives metadataBase / sitemap / robots / hreflang).'
              })
              .url()
              .refine((value) => !value.includes('localhost') && !value.includes('127.0.0.1'), {
                  message:
                      'NEXT_PUBLIC_APP_URL must not be localhost / 127.0.0.1 in production — set the public origin (e.g. https://example.com).'
              })
        : z.string().url().default('http://localhost:3000')
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Validated public env for server modules (layout, sitemap, robots, config).
 * NEXT_PUBLIC_* is inlined for the client bundle where imported from client files.
 */
export function getPublicEnv(): PublicEnv {
    return publicEnvSchema.parse({
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    });
}

export function getAppBaseUrl(): string {
    return getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}
