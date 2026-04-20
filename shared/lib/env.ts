import { z } from 'zod';

const publicEnvSchema = z.object({
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000')
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
