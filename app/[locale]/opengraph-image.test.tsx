// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import messages from '@/messages/en.json';

import Image, { contentType, size } from './opengraph-image';

// `next-intl/server` reads the request context Next.js builds per render; vitest has none.
vi.mock('next-intl/server', () => ({
    getTranslations: () =>
        Promise.resolve((key: string): string => {
            const root = messages.meta.root as Record<string, string>;
            return root[key] ?? key;
        })
}));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe('opengraph-image', () => {
    it('declares the 1200x630 PNG every social network scales from', () => {
        expect(size).toEqual({ width: 1200, height: 630 });
        expect(contentType).toBe('image/png');
    });

    it('renders a PNG for a served locale', async () => {
        const response = await Image({ params: Promise.resolve({ locale: 'en' }) });
        const bytes = new Uint8Array(await response.arrayBuffer());

        expect(response.headers.get('content-type')).toBe('image/png');
        expect([...bytes.slice(0, PNG_SIGNATURE.length)]).toEqual(PNG_SIGNATURE);
    });

    it('answers 404 for a locale the routing does not serve', async () => {
        await expect(Image({ params: Promise.resolve({ locale: 'xx' }) })).rejects.toMatchObject({
            digest: expect.stringContaining('404') as unknown
        });
    });
});
