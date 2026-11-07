import { describe, expect, it } from 'vitest';

import UnknownRoutePage from './page';

describe('unknown route page', () => {
    // Next answers 404 for an unmatched path below the locale segment either way; what this page
    // adds is that the 404 is raised from inside the locale layout, so its `not-found` renders in the
    // document the layout owns (language, theme, header, footer) instead of Next's built-in one.
    it('answers 404 from inside the locale layout', () => {
        expect(() => UnknownRoutePage()).toThrow(
            expect.objectContaining({ digest: expect.stringContaining('404') as unknown })
        );
    });
});
