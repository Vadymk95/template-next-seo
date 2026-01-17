// Shared constants
// Add constants here that are used across multiple features/entities

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const ROUTES = {
    HOME: '/',
    EXAMPLE_FORM: '/example-form'
} as const;
