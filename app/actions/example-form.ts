'use server';

import { getTranslations } from 'next-intl/server';

import { exampleFormSchema } from '@/features/example-form/model/schema';
import { logger } from '@/shared/lib/logger';

export type ExampleFormActionSuccess = {
    success: true;
    message: string;
    data: { name: string; email: string };
};

export type ExampleFormActionFailure = {
    success: false;
    fieldErrors?: Record<string, string>;
    error?: string;
};

export async function exampleFormAction(
    formData: FormData
): Promise<ExampleFormActionSuccess | ExampleFormActionFailure> {
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
        return {
            success: false,
            fieldErrors
        };
    }

    try {
        const validatedData = parsed.data;

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
            success: true,
            message: tCommon('submittedSuccessfully'),
            data: validatedData
        };
    } catch (err) {
        logger.error(
            '[example-form-action] submit failed',
            err instanceof Error ? err : new Error(String(err))
        );
        return {
            success: false,
            error: tErrors('unexpectedError')
        };
    }
}
