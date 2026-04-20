import type { z } from 'zod';

import type { exampleFormSchema } from './schema';

// FSD convention: derive feature types from the Zod schema (single source of truth).
// Add request/response shapes here when the feature grows beyond the form payload.

export type ExampleFormData = z.infer<typeof exampleFormSchema>;

export type ExampleFormResult = {
    success: boolean;
    message?: string;
    error?: string;
    data?: ExampleFormData;
    errors?: Array<{ path: string[]; message: string }>;
};
