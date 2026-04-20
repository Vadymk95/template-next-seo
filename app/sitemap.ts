import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { getAppBaseUrl } from '@/shared/lib/env';

type SitemapRoute = {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
};

const ROUTES: SitemapRoute[] = [
    { path: '', changeFrequency: 'weekly', priority: 1 },
    { path: '/example-form', changeFrequency: 'weekly', priority: 0.8 }
];

const sitemap = (): MetadataRoute.Sitemap => {
    const base = getAppBaseUrl();
    const lastModified = new Date();

    return ROUTES.flatMap(({ path, changeFrequency, priority }) => {
        const languages = Object.fromEntries(
            routing.locales.map((locale) => [locale, `${base}/${locale}${path}`])
        ) as Record<string, string>;

        return routing.locales.map((locale) => ({
            url: `${base}/${locale}${path}`,
            lastModified,
            changeFrequency,
            priority,
            alternates: { languages }
        }));
    });
};

export default sitemap;
