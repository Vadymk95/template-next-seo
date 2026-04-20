import type { MetadataRoute } from 'next';

import { getAppBaseUrl } from '@/shared/lib/env';

const robots = (): MetadataRoute.Robots => {
    if (process.env.NODE_ENV !== 'production') {
        return {
            rules: {
                userAgent: '*',
                disallow: '/'
            }
        };
    }

    const base = getAppBaseUrl();
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/api/'
        },
        sitemap: `${base}/sitemap.xml`
    };
};

export default robots;
