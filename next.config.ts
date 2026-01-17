import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true'
});

const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    // Exclude dev routes from production build
    ...(process.env.NODE_ENV === 'production' && {
        outputFileTracingExcludes: {
            '/dev/**': ['app/dev/**']
        }
    }),
    async headers() {
        return [
            {
                source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|otf|eot)$).*)',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    }
                ]
            }
        ];
    },
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [],
        minimumCacheTTL: 60,
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
    },
    experimental: {
        optimizePackageImports: [
            'lucide-react',
            '@radix-ui/react-slot',
            '@radix-ui/react-accordion',
            '@radix-ui/react-label',
            'zustand',
            '@tanstack/react-query',
            'react-i18next',
            'i18next',
            'i18next-browser-languagedetector',
            'i18next-http-backend',
            'react-hook-form',
            '@hookform/resolvers',
            'zod'
        ]
    },
    compiler: {
        removeConsole:
            process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
    },
    webpack: (config, { isServer, dev }) => {
        // Exclude dev routes from production client bundle
        if (!isServer && !dev) {
            // Remove dev routes from entry points
            if (config.entry && typeof config.entry === 'object') {
                Object.keys(config.entry).forEach((key) => {
                    if (key.includes('/dev/')) {
                        delete config.entry[key];
                    }
                });
            }
        }

        if (!isServer && !dev) {
            const originalSplitChunks = config.optimization?.splitChunks;
            config.optimization = {
                ...config.optimization,
                splitChunks: {
                    ...originalSplitChunks,
                    maxInitialRequests: 25,
                    minSize: 20000,
                    maxSize: 244000,
                    cacheGroups: {
                        ...originalSplitChunks?.cacheGroups,
                        default: false,
                        vendors: false,
                        reactVendor: {
                            name: 'react-vendor',
                            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                            priority: 40,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        nextVendor: {
                            name: 'next-vendor',
                            test: /[\\/]node_modules[\\/]next[\\/]/,
                            priority: 35,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        stateVendor: {
                            name: 'state-vendor',
                            test: /[\\/]node_modules[\\/](zustand|@tanstack[\\/]react-query)[\\/]/,
                            priority: 30,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        uiVendor: {
                            name: 'ui-vendor',
                            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|clsx|tailwind-merge)[\\/]/,
                            priority: 20,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        i18nVendor: {
                            name: 'i18n-vendor',
                            test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector|i18next-http-backend)[\\/]/,
                            priority: 20,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        formVendor: {
                            name: 'form-vendor',
                            test: /[\\/]node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/,
                            priority: 15,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        common: {
                            name: 'common',
                            minChunks: 2,
                            priority: 10,
                            reuseExistingChunk: true,
                            minSize: 20000
                        }
                    }
                }
            };
        }
        return config;
    },
    productionBrowserSourceMaps: false,
    modularizeImports: {
        'lucide-react': {
            transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}'
        }
    }
};

export default withBundleAnalyzer(nextConfig);
