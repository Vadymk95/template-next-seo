'use server';

import { z } from 'zod';

import { exampleFormSchema } from '@/features/example-form/model/schema';

export async function exampleFormAction(formData: FormData) {
    try {
        const rawData = {
            name: formData.get('name'),
            email: formData.get('email')
        };

        // Validate data
        const validatedData = exampleFormSchema.parse(rawData);

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
            success: true,
            message: 'Form submitted successfully',
            data: validatedData
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: 'Validation failed',
                errors: error.issues
            };
        }

        return {
            success: false,
            error: 'An unexpected error occurred'
        };
    }
}
