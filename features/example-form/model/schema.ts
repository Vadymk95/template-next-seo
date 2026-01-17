import { z } from 'zod';

export const exampleFormSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    email: z.string().email('Invalid email format')
});

export type ExampleFormSchema = z.infer<typeof exampleFormSchema>;
