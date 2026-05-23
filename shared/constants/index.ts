// Template scaffolding — DO NOT REMOVE as "unused".
// This barrel is an intentional example of the FSD constants convention so MVPs forked from this
// template have a pre-wired place for ROUTES, API_BASE_URL, and other cross-feature literals.
// Delete only after the forked project actively uses its own constants and no longer needs the pattern example.
// See .cursor/brain/SKELETONS.md → "Template scaffolding".

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const ROUTES = {
    HOME: '/',
    EXAMPLE_FORM: '/example-form'
} as const;

/**
 * CSP Reporting endpoint name. Single source for the `Reporting-Endpoints`
 * header key in `next.config.ts` AND the `report-to <name>` directive emitted
 * by `shared/lib/cspHeader.ts`. These two MUST stay in lock-step or browsers
 * silently drop CSP violation reports (header announces an endpoint name the
 * policy never references). External contract: ties together two
 * configuration sites that the browser correlates at runtime.
 */
export const CSP_REPORTING_ENDPOINT_NAME = 'csp-endpoint';

/**
 * Server-side route paths under `/api/*`. Extracted because the CSP report
 * URL is part of an external browser contract (Reporting-Endpoints header
 * advertises this path; route handler must live at the same path).
 * Other `/api/*` paths (`health`, `example-form`, `vitals`) intentionally
 * stay inline at their single call site as Template scaffolding seeds —
 * forks decide whether to centralise as they grow.
 */
export const API_PATHS = {
    CSP_REPORT: '/api/csp-report'
} as const;
