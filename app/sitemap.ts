import type { MetadataRoute } from 'next';

import { getAppBaseUrl } from '@/shared/lib/env';

const sitemap = (): MetadataRoute.Sitemap => {
    const base = getAppBaseUrl();
    return [
        {
            url: `${base}/`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1
        }
    ];
};

export default sitemap;
