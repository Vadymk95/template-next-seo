import { describe, expect, it } from 'vitest';

import {
    CHROME_BRAND_LABEL,
    CHROME_BRAND_LINK,
    CHROME_LINK_BASE,
    CHROME_MUTED_LINK,
    CHROME_NAV_LINK
} from './chromeLink';

/**
 * These are class strings, so there is nothing to render and jsdom could not measure the resulting box
 * anyway — `e2e/layout-geometry.spec.ts` does that in a browser. What a unit test CAN do is pin the
 * pairing that makes the box possible, and fail in a second rather than in a full e2e run.
 */
describe('chrome link classes', () => {
    it('keeps the touch height together with the display mode that makes it apply', () => {
        // `min-h-11` on an inline box is ignored outright — the height comes from the line box. An edit
        // that drops `inline-flex` would leave a class that looks like a guard and is not one.
        expect(CHROME_LINK_BASE).toContain('min-h-11');
        expect(CHROME_LINK_BASE).toContain('inline-flex');
        expect(CHROME_LINK_BASE).toContain('items-center');
    });

    it('gives every chrome link variant the touch row', () => {
        for (const [name, className] of Object.entries({
            nav: CHROME_NAV_LINK,
            muted: CHROME_MUTED_LINK,
            brand: CHROME_BRAND_LINK
        })) {
            expect(className, `${name} lost its touch row`).toContain(CHROME_LINK_BASE);
        }
    });

    it('lets the brand shrink and truncates on the inner label', () => {
        expect(CHROME_BRAND_LINK).toContain('min-w-0');
        // `text-overflow` does not apply to a flex container, so `truncate` on the link would be inert.
        expect(CHROME_BRAND_LINK).not.toContain('truncate');
        expect(CHROME_BRAND_LABEL).toContain('truncate');
    });
});
