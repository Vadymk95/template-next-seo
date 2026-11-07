import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DevPlaygroundLayout from './layout';

// The font loader is a build-time transform, so the test gets a stand-in with the same shape.
vi.mock('next/font/google', () => ({ Inter: () => ({ variable: 'font-inter-variable' }) }));

interface DocumentProps {
    children?: ReactNode;
    className?: string;
    lang?: string;
    suppressHydrationWarning?: boolean;
}

const documentOf = (children: ReactNode): ReactElement<DocumentProps> =>
    DevPlaygroundLayout({ children }) as ReactElement<DocumentProps>;

describe('dev playground layout', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    // `app/layout.tsx` is gone: the locale layout is one root layout, and this is the other. A route
    // under `app/dev/ui` that renders no `<html>` and `<body>` fails the build.
    it('is a root layout: it renders the document around the playground', () => {
        const page = <p>playground</p>;
        const tree = documentOf(page);

        expect(tree.type).toBe('html');
        expect(tree.props.lang).toBe('en');
        expect(tree.props.className).toContain('font-inter-variable');
        expect(tree.props.className?.split(' ')).toContain('dark');
        // Browser extensions and a theme script change attributes on `<html>` before React hydrates it.
        expect(tree.props.suppressHydrationWarning).toBe(true);

        const body = tree.props.children as ReactElement<DocumentProps>;
        expect(body.type).toBe('body');
        expect(body.props.children).toBe(page);
    });

    it('answers 404 in production', () => {
        vi.stubEnv('NODE_ENV', 'production');

        expect(() => documentOf(null)).toThrow(
            expect.objectContaining({ digest: expect.stringContaining('404') as unknown })
        );
    });
});
