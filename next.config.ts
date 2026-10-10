import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { API_PATHS, CSP_REPORTING_ENDPOINT_NAME } from './shared/constants';
import { buildStaticContentSecurityPolicy } from './shared/lib/cspHeader';

/*
 * The vendor groups below are `enforce: true`, so they take EVERY module under their `node_modules`
 * path, whatever its type. `next/font` generates its @font-face sheet from inside `node_modules/next`
 * (module type `css/mini-extract`), so `nextVendor` pulled that stylesheet into the `next-vendor` chunk
 * group. The App Router then listed the .css file among the root main files and emitted
 * `<script src="/_next/static/css/<hash>.css" async>` beside its `<link rel="stylesheet">`; under
 * `X-Content-Type-Options: nosniff` the browser refuses to run `text/css` and logs an error on every page.
 * Restricting the groups to JavaScript module types keeps the vendor split and leaves CSS to Next.
 */
const JAVASCRIPT_MODULES = /^javascript\//;

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const __rootDir = path.dirname(fileURLToPath(import.meta.url));

const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true'
});

/*
 * The dev smoke and the production gate must not share a build directory. Next documents `lockDistDir`
 * precisely because two processes writing one `distDir` "can mangle the state of the directory", and
 * `verify:full` does exactly that: it builds into `.next`, serves production from it, then starts
 * `next dev` on the same path. The third observed failure shape leaks into the NEXT run, as a
 * `.next/dev/types/routes.d.ts` truncated mid-write that fails the following `tsc`.
 */
const distDir = process.env.NEXT_DIST_DIR ?? '.next';

const nextConfig: NextConfig = {
    distDir,
    // `next dev` otherwise writes its own managed block into AGENTS.md when it detects a coding agent.
    // AGENTS.md is this repo's own law; the one pointer worth keeping from that block is written there by hand.
    agentRules: false,
    headers: async () => {
        const isDev = process.env.NODE_ENV !== 'production';
        const staticCsp = buildStaticContentSecurityPolicy(isDev);
        const securityHeaders: { key: string; value: string }[] = [
            { key: 'X-DNS-Prefetch-Control', value: 'on' },
            { key: 'Content-Security-Policy', value: staticCsp },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            {
                key: 'Permissions-Policy',
                value: 'camera=(), microphone=(), geolocation=()'
            },
            {
                key: 'Reporting-Endpoints',
                value: `${CSP_REPORTING_ENDPOINT_NAME}="${API_PATHS.CSP_REPORT}"`
            },
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
            { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }
        ];
        if (process.env.NODE_ENV === 'production') {
            securityHeaders.push({
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains; preload'
            });
        }
        return [{ source: '/:path*', headers: securityHeaders }];
    },
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
            'next-intl',
            '@hookform/resolvers',
            'zod',
            // Template scaffolding: lucide-react is pre-wired as the default icon set for MVPs.
            // See .cursor/brain/SKELETONS.md → "Template scaffolding" before removing.
            'lucide-react'
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
                            type: JAVASCRIPT_MODULES,
                            priority: 40,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        nextVendor: {
                            name: 'next-vendor',
                            test: /[\\/]node_modules[\\/]next[\\/]/,
                            type: JAVASCRIPT_MODULES,
                            priority: 35,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        zustandVendor: {
                            name: 'zustand-vendor',
                            test: /[\\/]node_modules[\\/]zustand[\\/]/,
                            type: JAVASCRIPT_MODULES,
                            priority: 30,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        uiVendor: {
                            name: 'ui-vendor',
                            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|clsx|tailwind-merge)[\\/]/,
                            type: JAVASCRIPT_MODULES,
                            priority: 20,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        i18nVendor: {
                            name: 'i18n-vendor',
                            test: /[\\/]node_modules[\\/]next-intl[\\/]/,
                            type: JAVASCRIPT_MODULES,
                            priority: 20,
                            reuseExistingChunk: true,
                            enforce: true
                        },
                        formVendor: {
                            name: 'form-vendor',
                            test: /[\\/]node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/,
                            type: JAVASCRIPT_MODULES,
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
    productionBrowserSourceMaps: false
};

export default withNextIntl(withBundleAnalyzer(nextConfig));
