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
