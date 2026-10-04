import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const SEVERE_IMPACTS = new Set<string | null | undefined>(['serious', 'critical']);

/**
 * Runs axe-core against the page as it is RIGHT NOW and fails on serious or critical violations.
 *
 * Called from the page-level specs that already load each public route, so a scan costs one
 * `analyze()` on a page that is on screen anyway and adds no test of its own. Call it after the spec's
 * own readiness assertion: axe scans whatever is in the DOM, and a page caught before it rendered has
 * almost nothing to violate.
 *
 * `target-size` (WCAG 2.2 SC 2.5.8) is off by default in axe-core, so it is switched on here. The
 * geometry specs measure the larger touch floor on their own; this is the standard's minimum.
 * Moderate and minor findings are deliberately not failures: they are advice a template cannot act on
 * without taking a design position.
 */
export const expectNoSevereA11yViolations = async (page: Page): Promise<void> => {
    const results = await new AxeBuilder({ page })
        .options({ rules: { 'target-size': { enabled: true } } })
        .analyze();

    const severe = results.violations
        .filter(({ impact }) => SEVERE_IMPACTS.has(impact))
        .map(
            ({ id, impact, help, nodes }) =>
                `${id} (${String(impact)}): ${help}\n${nodes.map(({ target }) => `    ${JSON.stringify(target)}`).join('\n')}`
        );

    expect(severe, `axe found serious or critical violations on ${page.url()}`).toEqual([]);
};
