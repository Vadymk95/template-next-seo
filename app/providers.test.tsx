import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Providers } from './providers';

/*
 * The provider starts its analytics hook-up from an effect: a `load` listener while the page is
 * still loading, otherwise a zero-delay timer when the browser has no idle callback. Both outlive the
 * component unless the effect cleans up, so each case unmounts and reads what was released.
 */
describe('Providers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('removes the load listener it added when it unmounts before the page has loaded', () => {
        vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const add = vi.spyOn(window, 'addEventListener');
        const remove = vi.spyOn(window, 'removeEventListener');

        const { unmount } = render(<Providers>content</Providers>);
        const added = add.mock.calls.find(([type]) => type === 'load');
        unmount();

        expect(added).toBeDefined();
        expect(remove).toHaveBeenCalledWith('load', added?.[1]);
    });

    it('clears the timer it started when there is no idle callback and it unmounts', () => {
        vi.useFakeTimers();
        vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
        const start = vi.spyOn(globalThis, 'setTimeout');
        const clear = vi.spyOn(globalThis, 'clearTimeout');

        const { unmount } = render(<Providers>content</Providers>);
        const timerId: unknown = start.mock.results.at(-1)?.value;
        unmount();

        expect(clear).toHaveBeenCalledWith(timerId);
    });
});
