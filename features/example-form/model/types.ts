import type { z } from 'zod';

import type { exampleFormSchema } from './schema';

// Template scaffolding — DO NOT REMOVE as "unused".
// Demonstrates the FSD convention: derive feature types from the Zod schema (single source of truth)
// and place them in `model/types.ts` next to the schema. Kept so MVPs forked from this template see
// the expected shape of a feature's model layer. See .cursor/brain/SKELETONS.md → "Template scaffolding".

export type ExampleFormData = z.infer<typeof exampleFormSchema>;

export type ExampleFormResult = {
    success: boolean;
    message?: string;
    error?: string;
    data?: ExampleFormData;
    errors?: Array<{ path: string[]; message: string }>;
};
