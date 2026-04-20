# Next.js SEO Template

Production-ready Next.js template optimized for SEO, performance, and developer experience.

**Architecture:** Feature-Sliced Design (FSD) for maximum scalability.

## 🚀 Features

### Core Stack

- **Next.js 16** with App Router
- **React 19** with automatic JSX runtime
- **TypeScript** strict mode
- **Tailwind CSS v4** (PostCSS + `app/globals.css` theme tokens) + Shadcn-style UI in `shared/ui/`
- **Zustand** for client-side state management
- **next-intl** for App Router SSR i18n (`[locale]` segment, localized metadata, `hreflang`)
- **Vitest** + Testing Library for testing

### Performance & SEO

- ✅ **Bundle optimization** — see Performance Metrics. Run `npm run build:analyze` to see breakdown.
- ✅ **Vendor chunking** - via `optimizePackageImports` + webpack cache groups
- ✅ **Tree-shaking** via `optimizePackageImports`
- ✅ **Image optimization** - AVIF/WebP formats, responsive sizes
- ✅ **ISR** - `/` (revalidate 1h) and `/example-form` (revalidate 30m) are statically generated at build time
- ✅ **Cache-Control headers** - optimized API caching
- ✅ **Metadata API** - automatic meta tags, Open Graph, Twitter Cards
- ✅ **Sitemap** generation (`app/sitemap.ts`)
- ✅ **Robots.txt** configuration (`app/robots.ts`)
- ✅ **Web Vitals tracking** - Core Web Vitals monitoring

### Security

- ✅ **Edge proxy** (`proxy.ts`) - stricter CSP + rate limits for `/api/*` and `/dev/*`
- ✅ **Rate limiting** - 100 requests/minute for API routes
- ✅ **Security headers** - static set in `next.config.ts`, CSP override on API/dev via `proxy.ts`
- ✅ **Input validation** - Zod schemas for forms and API routes

### Developer Experience

- ✅ **Cursor rules** - pipeline + FSD, testing, and workflow (see `.cursor/rules/`)
- ✅ **ESLint Flat Config** - modern linting setup
- ✅ **Prettier** - code formatting
- ✅ **Husky hooks** - pre-commit and commit-msg validation
- ✅ **CI/CD** - GitHub Actions workflow
- ✅ **Structured logging** - JSON format in production
- ✅ **Health check** endpoint (`/api/health`)

### Error Handling

- ✅ **Global error boundary** (`app/error.tsx`)
- ✅ **404 page** (`app/not-found.tsx`)
- ✅ **Component error boundary** (`shared/ui/common/ErrorBoundary`)
- ✅ **Loading states** (`app/loading.tsx`)
- ✅ **Error logging** - structured error tracking

### Forms & Validation

- ✅ **React Hook Form** integration
- ✅ **Zod** schema validation
- ✅ **Server Actions** for form submission
- ✅ **Example form** at `/example-form`

### API Routes

- ✅ **RESTful API** examples (`app/api/example-form/route.ts`)
- ✅ **Health check** endpoint (`app/api/health/route.ts`)
- ✅ **Error handling** in API routes
- ✅ **Cache-Control headers** for optimal caching
- ✅ **Type-safe** request/response handling

## 📦 Quick Start

```bash
# Install dependencies
npm install

# Create .env.local only if your project needs environment variables

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Build & lint notes (Next 16)

- **`npm run build`** runs **`next build --webpack`** because `next.config.ts` customizes **webpack** `splitChunks` (vendor caching for React, Next, Zustand, i18n, forms, UI). Use **`npm run build:turbo`** only if you accept Turbopack defaults without those splits.
- **`npm run lint`** runs **ESLint** directly (`eslint . --max-warnings 0`). The **`next lint`** subcommand is not available on this Next major version.
- **Enterprise verification**: **`npm run verify:enterprise`** runs lint → format → TypeScript → tests → production build (same spirit as CI). **`npm run bench:verify`** runs the same steps and prints **per-step durations** for local benchmarking.

### Security (production)

- **CSP**: static policy on pages via **`next.config.ts`**; per-request **nonce** + **`strict-dynamic`** for `script-src` on **`/api/*`** and **`/dev/*`** only (development keeps relaxed rules for HMR).
- **Headers**: HSTS (**`preload`** — [submit the domain](https://hstspreload.org/) before relying on preload in browsers), **COOP** / **CORP**, frame protections, Permissions-Policy — baseline from **`next.config.ts`**, CSP tightened in **`proxy.ts`** for matched routes.
- **Rate limiting**: set **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** in your local or deployment environment for **sliding-window** limits shared across regions; otherwise **in-memory** fallback (edge isolate).
- **`/dev/*`**: returns **404 in production** (no webpack entry hacks).

## 📁 Project Structure (FSD)

```
app/                    # Next.js App Router (routing layer)
  ├── api/             # API routes (by domain)
  │   ├── example-form/
  │   └── health/
  ├── actions/          # Server Actions (by domain)
  │   └── example-form.ts
  ├── [locale]/         # Locale segment (next-intl SSR)
  │   ├── layout.tsx   # setRequestLocale + NextIntlClientProvider (Header/Footer)
  │   ├── page.tsx     # Home; localized generateMetadata + alternates.languages
  │   └── example-form/
  ├── layout.tsx        # Root layout (fonts, title.default + title.template cascade)
  ├── providers.tsx     # Client providers (analytics)
  ├── error.tsx         # Global error boundary
  ├── loading.tsx       # Global loading UI
  ├── not-found.tsx     # 404 page
  ├── sitemap.ts        # Sitemap with per-route xhtml:link hreflang entries
  └── robots.ts         # Robots.txt config

i18n/                   # next-intl configuration
  ├── routing.ts        # defineRouting({ locales, defaultLocale })
  ├── request.ts        # getRequestConfig (messages loader)
  └── navigation.ts     # createNavigation (typed Link / redirect / hooks)

messages/               # Translation sources (single source of truth)
  └── en.json

shared/                 # Shared code (reusable)
  ├── ui/              # UI components (Shadcn)
  │   ├── common/      # Common components (Header, Footer, ErrorBoundary)
  │   ├── hocs/        # Higher-order components
  │   ├── button.tsx
  │   └── input.tsx
  ├── lib/             # Utilities and configs
  │   ├── logger.ts    # Structured logging
  │   ├── web-vitals.ts # Web Vitals tracking
  │   └── test-utils/  # Test utilities (NextIntlClientProvider wrapper)
  ├── types/           # Shared TypeScript types
  └── constants/       # Shared constants

features/               # Features (isolated)
  └── example-form/     # Example form feature
      ├── ui/          # UI components
      ├── model/       # Business logic, schemas
      └── index.ts     # Public API
```

## 🎯 Key Concepts

### Layouts in Next.js App Router

**Root Layout (`app/layout.tsx`):**

- Wraps ALL pages automatically
- Contains Header and Footer (shared across all pages)
- Perfect for common UI elements
- Not re-rendered on navigation (unlike SPA)

**Nested Layouts:**

- Each route group can have its own `layout.tsx`
- Useful for different sections (marketing, dashboard, etc.)

```typescript
// app/layout.tsx - Root layout (applies to all pages)
export default function RootLayout({ children }) {
    return (
        <html>
            <body>
                <Header />      {/* Shared header */}
                <main>{children}</main>
                <Footer />      {/* Shared footer */}
            </body>
        </html>
    );
}
```

### Pages vs Layouts

- **Pages** (`page.tsx`) - Route content, can have metadata
- **Layouts** (`layout.tsx`) - Shared UI, persist across navigation
- **Templates** (`template.tsx`) - Re-render on navigation (rarely used)

### Server vs Client Components

- **Server Components** (default) - No 'use client', runs on server
- **Client Components** - Add 'use client', can use hooks and browser APIs

## 🛠️ Commands

```bash
# Development
npm run dev              # Next.js dev server with Turbopack (default, faster)
npm run dev:webpack      # Use Webpack instead (for compatibility)

# Build
npm run build            # Production build (uses Webpack for custom optimizations)
npm run build:analyze    # Build with bundle analyzer
npm run build:webpack    # Explicitly use Webpack (same as build)

# Quality
npm run lint             # ESLint check
npm run format           # Prettier formatting
npm run format:check     # Prettier check
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## 📚 Examples

### API Route with Caching

```typescript
// app/api/example/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(
        { data: 'example' },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        }
    );
}
```

### Server Action

```typescript
// app/actions/example.ts
'use server';

import { z } from 'zod';

const schema = z.object({
    name: z.string().min(1)
});

export async function exampleAction(formData: FormData) {
    const data = schema.parse({
        name: formData.get('name')
    });
    // Process data...
    return { success: true };
}
```

### Page with ISR

```typescript
// app/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Home',
    description: 'Welcome'
};

// ISR: Revalidate every hour
export const revalidate = 3600;

export default function HomePage() {
    return <div>Home</div>;
}
```

### Form with Validation

See `features/example-form/` for complete example:

- React Hook Form integration
- Zod schema validation
- Server Action integration
- Loading states
- Error handling

### Using Web Vitals

```typescript
// Already integrated in app/providers.tsx
// Automatically tracks CLS, INP, FCP, LCP, TTFB
```

### Using Logger

```typescript
import { logger } from '@/shared/lib';

logger.info('User action', { userId: '123' });
logger.error('API error', error, { endpoint: '/api/users' });
```

## 🌐 Internationalization (next-intl SSR)

### Structure

```
i18n/
  routing.ts        # defineRouting({ locales: ['en'], defaultLocale: 'en' })
  request.ts        # getRequestConfig — validates locale, loads messages
  navigation.ts     # createNavigation — typed Link / redirect / hooks

messages/
  en.json           # Flat namespace tree: common, errors, home, meta, ...

app/[locale]/
  layout.tsx        # setRequestLocale + NextIntlClientProvider
  page.tsx          # localized generateMetadata + alternates.languages
```

### Usage — Server Components

```typescript
// app/[locale]/page.tsx
import { getTranslations } from 'next-intl/server';

export const generateMetadata = async ({ params }) => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'meta.home' });
    return { title: t('title'), description: t('description') };
};
```

### Usage — Client Components

```typescript
'use client';

import { useTranslations } from 'next-intl';

export const Component = () => {
    const t = useTranslations('home');
    return <h1>{t('title')}</h1>;
};
```

### Usage — Server Actions

```typescript
'use server';
import { getTranslations } from 'next-intl/server';

export async function exampleAction() {
    const t = await getTranslations('common.form');
    return { success: true, message: t('submittedSuccessfully') };
}
```

### Adding Languages

1. Add the code to `locales` in `i18n/routing.ts`
2. Create `messages/<code>.json` (copy `en.json`, translate values)
3. Middleware and `alternates.languages` pick up the new locale automatically

### Caveat — title.template cascade

Next.js does **not** apply `title.template` to the segment that defines it — only to descendants. The brand chrome (`title.default` + `title.template`) lives in root `app/layout.tsx`; `app/[locale]/layout.tsx` sets only `description` / `openGraph` / `twitter`. Do not move the template into `[locale]/layout.tsx` — the home page title will lose the suffix.

## 🔒 Security Features

### Edge proxy (`proxy.ts`)

- Per-request CSP (nonce + `strict-dynamic` in production) for `/api/*` and `/dev/*`
- Rate limiting (100 req/min) for matched routes
- Production **404** for `/dev/*`

### Security Headers

- **Static** (all routes): HSTS (production), X-Frame-Options, Referrer-Policy, Permissions-Policy, Reporting-Endpoints, COOP, CORP, baseline CSP — `next.config.ts` `headers()`
- **Dynamic CSP** (matched routes only): nonce + `strict-dynamic` for `script-src` — `proxy.ts`

## 📊 Performance Metrics

### Bundle Sizes

- **First Load JS:** ~154 kB (gzipped rootMainFiles + polyfills; run `npm run build:analyze` for a breakdown)
- **Vendor chunks:** `optimizePackageImports` + webpack cache groups (React, Next, Zustand, i18n, forms, UI)

### Optimizations

- ✅ Vendor chunking via webpack cache groups
- ✅ Tree-shaking (package imports)
- ✅ Code splitting (dynamic imports)
- ✅ Image optimization (AVIF/WebP)
- ✅ Font optimization (next/font)
- ✅ ISR for `/` and `/example-form`
- ✅ API route caching

## 🧪 Testing

### Setup

- **Vitest** - Test runner
- **Testing Library** - Component testing
- **Test utilities** - `renderWithProviders` helper

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Example Test

```typescript
import { renderWithProviders } from '@/shared/lib/test-utils/test-utils';
import { Component } from './Component';

describe('Component', () => {
    it('renders correctly', () => {
        const { getByText } = renderWithProviders(<Component />);
        expect(getByText('Hello')).toBeInTheDocument();
    });
});
```

## 📖 Documentation

### Architecture

- **FSD Architecture** - Feature-Sliced Design principles
- **Import Rules** - Layer dependencies (app → features → shared; add `entities/` when you need domain slices)
- **Component Patterns** - Server vs Client Components

### Development Guidelines

See `.cursor/rules/` for comprehensive guidelines:

- `react-patterns.mdc` - React 19 + Next.js patterns
- `routing.mdc` - File-based routing
- `fsd-architecture.mdc` - FSD rules
- `performance.mdc` - Performance optimizations
- `testing.mdc` - Testing patterns
- `workflow.mdc` - Git workflow and commits

## 🔧 Configuration

### Environment Variables

Create `.env.local` only for variables your project actually uses, for example:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Next.js SEO Template
```

### Next.js Config

Key optimizations in `next.config.ts`:

- Bundle analyzer
- Package imports optimization via `experimental.optimizePackageImports` (see next.config.ts)
- Webpack chunking strategy
- Image optimization
- Security headers (`headers()` + `proxy.ts` CSP on API/dev)

## 🚦 CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):

- Lint & Format check
- TypeScript type check
- Tests
- Build verification

## 📝 Code Quality

### Pre-commit Hooks (Husky)

- **pre-commit:** Runs `lint-staged` (ESLint + Prettier)
- **commit-msg:** Validates commit message format (commitlint)

### Commit Format

Follow conventional commits:

```
feat(scope): add new feature
fix(ui): handle form validation errors
chore(deps): update dependencies
```

## 🎨 UI Components

### Shadcn UI

Components are in `shared/ui/`:

- `Button` - Multiple variants and sizes
- `Input` - Form input with validation
- `ErrorBoundary` - Error handling component
- `Header` - Site header with navigation
- `Footer` - Site footer

## 🌍 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Setup

1. Set environment variables
2. Configure domain in `app/layout.tsx` metadata
3. Update `app/sitemap.ts` and `app/robots.ts` URLs

### Performance Checklist

- ✅ Bundle size under 200 kB First Load JS (see Performance Metrics)
- ✅ ISR for `/` and `/example-form`
- ✅ Cache-Control headers for API routes
- ✅ Security headers (`next.config.ts` + `proxy.ts`)
- ✅ Web Vitals tracking enabled

## Removed dependencies (restore playbook)

These packages were stripped as unused. Commands to restore if a feature needs them again:

- **`web-vitals`** — removed with `shared/lib/web-vitals.ts`. The app uses `useReportWebVitals` from `next/web-vitals` (`app/WebVitalsReporter.tsx`). To restore the raw wrapper: `npm install web-vitals`, then recreate the wrapper module and re-export it from `shared/lib/index.ts`.

## Known trade-offs

- **CSP on static routes** uses a nonce-less baseline (`script-src 'self'` in production). Stricter nonce + `strict-dynamic` applies only on `/api/*` and `/dev/*` via `proxy.ts`.
- **Rate-limit identity** on non-Vercel hosts: set `RATE_LIMIT_TRUST_PROXY` to `vercel`, `first-hop`, or `none` so `X-Forwarded-For` is not trusted incorrectly.
- **Same-origin on APIs**: `POST`/`PUT`/`PATCH`/`DELETE` on `/api/example-form`, `/api/csp-report`, and `/api/vitals` require a matching `Origin` (same-tab `fetch` with `keepalive` instead of `sendBeacon` for vitals).

## 🤝 Contributing

1. Follow FSD architecture rules
2. Write tests for business logic (TDD)
3. Follow code style guidelines
4. Run `npm run lint` and `npm run format:check` before commit
5. Use conventional commit format

## 📄 License

MIT
