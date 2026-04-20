import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const __rootDir = path.dirname(fileURLToPath(import.meta.url));

const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true'
});

const nextConfig: NextConfig = {
    // Pin tracing/Turbopack root so a parent monorepo lockfile does not steal the workspace root
    outputFileTracingRoot: __rootDir,
    turbopack: {
        root: __rootDir
    },
    reactStrictMode: true,
    poweredByHeader: false,
    // Exclude dev routes from production build
    ...(process.env.NODE_ENV === 'production' && {
        outputFileTracingExcludes: {
            '/dev/**': ['app/dev/**']
        }
    }),
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [],
        minimumCacheTTL: 60,
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
    },
    experimental: {
        serverActions: {
            allowedOrigins: [appOrigin],
            bodySizeLimit: '1mb'
        },
        webVitalsAttribution: ['LCP', 'INP', 'CLS'],
        optimizePackageImports: [
            'zustand',
            'react-i18next',
            'i18next',
            'i18next-browser-languagedetector',
            'i18next-http-backend',
            '@hookform/resolvers',
            'zod'
        ]
    },
    compiler: {
        removeConsole:
            process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
    },
    webpack: (config, { isServer, dev }) => {
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
                            test: /[\\/]node_modules[\\/](zustand|@tanstack[\\/](react-query|query-core))[\\/]/,
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
