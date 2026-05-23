'use server';

import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { exampleFormSchema } from '@/features/example-form/model/schema';
import { logger } from '@/shared/lib/logger';

/**
 * Runtime contract for the value this Server Action returns to the client.
 *
 * Server Actions cross the server/client boundary as `Promise<unknown>` — the
 * client receives an opaque payload and has to trust the shape. Parsing the
 * return value with Zod before handing it back gives the client a runtime
 * guarantee, and `z.infer<typeof …>` keeps the public static types in lockstep
 * with the runtime schema (no manual drift). See `.cursor/brain/DECISIONS.md`
 * ADR "Boundary validation via Zod safeFetch + Server Action output schemas".
 */
const ServerActionResultSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        message: z.string(),
        data: z.object({
            name: z.string(),
            email: z.string()
        })
    }),
    z.object({
        success: z.literal(false),
        fieldErrors: z.record(z.string(), z.string()).optional(),
        error: z.string().optional()
    })
]);

export type ExampleFormActionResult = z.infer<typeof ServerActionResultSchema>;
export type ExampleFormActionSuccess = Extract<ExampleFormActionResult, { success: true }>;
export type ExampleFormActionFailure = Extract<ExampleFormActionResult, { success: false }>;

export async function exampleFormAction(formData: FormData): Promise<ExampleFormActionResult> {
    const tCommon = await getTranslations('common.form');
    const tErrors = await getTranslations('errors.page');

    const rawData = {
        name: formData.get('name'),
        email: formData.get('email')
    };

    const parsed = exampleFormSchema.safeParse(rawData);

    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const key = issue.path[0];
            if (typeof key === 'string' && !fieldErrors[key]) {
                fieldErrors[key] = issue.message;
            }
        }
        return ServerActionResultSchema.parse({
            success: false,
            fieldErrors
        });
    }

    try {
        const validatedData = parsed.data;

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return ServerActionResultSchema.parse({
            success: true,
            message: tCommon('submittedSuccessfully'),
            data: validatedData
        });
    } catch (err) {
        logger.error(
            '[example-form-action] submit failed',
            err instanceof Error ? err : new Error(String(err))
        );
        return ServerActionResultSchema.parse({
            success: false,
            error: tErrors('unexpectedError')
        });
    }
}
