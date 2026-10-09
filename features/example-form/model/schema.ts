import { z } from 'zod';

export const exampleFormSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- z.email() would also report a missing field with this format message, a user-visible change
    email: z.string().email('Invalid email format')
});

export type ExampleFormSchema = z.infer<typeof exampleFormSchema>;
