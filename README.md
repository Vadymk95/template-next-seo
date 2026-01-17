# Next.js SEO Template

Production-ready Next.js template optimized for SEO, performance, and developer experience.

**Architecture:** Feature-Sliced Design (FSD) for maximum scalability.

## 🚀 Features

### Core Stack

- **Next.js 15+** with App Router
- **React 19** with automatic JSX runtime
- **TypeScript** strict mode
- **Tailwind CSS** + Shadcn UI
- **Zustand** for client-side state management
- **TanStack Query** for server state management
- **i18next** for internationalization
- **Vitest** + Testing Library for testing

### Performance & SEO

- ✅ **Bundle optimization** - 163 kB First Load JS (excellent!)
- ✅ **Vendor chunking** - 7 optimized chunks (react, next, state, ui, i18n, form, common)
- ✅ **Tree-shaking** via `optimizePackageImports` and `modularizeImports`
- ✅ **Image optimization** - AVIF/WebP formats, responsive sizes
- ✅ **ISR (Incremental Static Regeneration)** - automatic revalidation
- ✅ **Cache-Control headers** - optimized API caching
- ✅ **Metadata API** - automatic meta tags, Open Graph, Twitter Cards
- ✅ **Sitemap** generation (`app/sitemap.ts`)
- ✅ **Robots.txt** configuration (`app/robots.ts`)
- ✅ **Web Vitals tracking** - Core Web Vitals monitoring

### Security

- ✅ **Security middleware** - CSP, HSTS, X-Frame-Options, etc.
- ✅ **Rate limiting** - 100 requests/minute for API routes
- ✅ **Security headers** - configured in `next.config.ts` and middleware
- ✅ **Input validation** - Zod schemas for forms and API routes

### Developer Experience

- ✅ **13 Cursor rules** - comprehensive development guidelines
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

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📁 Project Structure (FSD)

```
app/                    # Next.js App Router (routing layer)
  ├── api/             # API routes (by domain)
  │   ├── example-form/
  │   └── health/
  ├── actions/          # Server Actions (by domain)
  │   └── example-form.ts
  ├── [routes]/         # Pages (file-based routing)
  ├── layout.tsx        # Root layout (Header + Footer)
  ├── providers.tsx     # Client providers (QueryClient, i18n)
  ├── error.tsx         # Global error boundary
  ├── loading.tsx       # Global loading UI
  ├── not-found.tsx     # 404 page
  ├── sitemap.ts        # Sitemap generation
  └── robots.ts         # Robots.txt config

shared/                 # Shared code (reusable)
  ├── ui/              # UI components (Shadcn)
  │   ├── common/      # Common components (Header, Footer, ErrorBoundary)
  │   ├── hocs/        # Higher-order components
  │   ├── button.tsx
  │   └── input.tsx
  ├── lib/             # Utilities and configs
  │   ├── i18n/        # i18n configuration
  │   ├── queryClient.ts
  │   ├── logger.ts    # Structured logging
  │   ├── web-vitals.ts # Web Vitals tracking
  │   └── test-utils/  # Test utilities
  ├── types/           # Shared TypeScript types
  └── constants/       # Shared constants

entities/               # Business entities
  └── user/            # User entity
      ├── model/       # Types, interfaces
      └── store/       # Zustand store

features/               # Features (isolated)
  └── example-form/     # Example form feature
      ├── ui/          # UI components
      ├── model/       # Business logic, schemas
      └── index.ts     # Public API

hooks/                  # Custom hooks (by domain)
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

## 🌐 Internationalization (i18n)

### Structure

```
public/locales/
  en/
    common.json    # UI elements, buttons, navigation
    errors.json    # API/HTTP/validation errors
    home.json      # HomePage-specific content
```

### Usage

```typescript
'use client';

import { useTranslation } from 'react-i18next';

export const Component = () => {
    const { t } = useTranslation(['common', 'home']);
    return <h1>{t('home:title')}</h1>;
};
```

### Adding Languages

1. Create `public/locales/{lng}/` directory
2. Copy JSON files from `en/` and translate
3. Add to `SUPPORTED_LANGUAGES` in `shared/lib/i18n/constants.ts`

## 🔒 Security Features

### Middleware (`app/middleware.ts`)

- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy
- Permissions-Policy
- Strict-Transport-Security (HSTS)
- Rate limiting (100 req/min)

### Security Headers

Configured in:

- `app/middleware.ts` - Dynamic headers
- `next.config.ts` - Static headers

## 📊 Performance Metrics

### Bundle Sizes

- **First Load JS:** 163 kB (excellent! < 200 kB)
- **Shared chunks:** 141 kB (optimal for caching)
- **Vendor chunks:** Optimized splitting (react, next, state, ui, i18n, form)

### Optimizations

- ✅ Vendor chunking (7 chunks)
- ✅ Tree-shaking (package imports)
- ✅ Code splitting (dynamic imports)
- ✅ Image optimization (AVIF/WebP)
- ✅ Font optimization (next/font)
- ✅ ISR for static pages
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
- **Import Rules** - Layer dependencies (app → features → entities → shared)
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

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Next.js SEO Template
```

### Next.js Config

Key optimizations in `next.config.ts`:

- Bundle analyzer
- Package imports optimization
- Modularize imports (lucide-react)
- Webpack chunking strategy
- Image optimization
- Security headers

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

### Adding Components

```bash
npx shadcn@latest add [component-name]
```

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

- ✅ Bundle size < 200 kB (163 kB ✅)
- ✅ ISR configured for static pages
- ✅ Cache-Control headers for API routes
- ✅ Security headers configured
- ✅ Web Vitals tracking enabled

## 🤝 Contributing

1. Follow FSD architecture rules
2. Write tests for business logic (TDD)
3. Follow code style guidelines
4. Run `npm run lint` and `npm run format:check` before commit
5. Use conventional commit format

## 📄 License

MIT
