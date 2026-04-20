'use client';

import { zodResolver } from '@hookform/resolvers/zod';
// Template scaffolding: canonical lucide-react usage example (pending/idle submit button).
// See .cursor/brain/SKELETONS.md → "Template scaffolding".
import { Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FunctionComponent } from 'react';
import { useForm } from 'react-hook-form';

import { exampleFormAction } from '@/app/actions/example-form';
import { exampleFormSchema, type ExampleFormSchema } from '@/features/example-form/model/schema';
import { Button, Input } from '@/shared/ui';

export const ExampleForm: FunctionComponent = () => {
    const tCommon = useTranslations('common');
    const tErrors = useTranslations('errors');
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        setError,
        clearErrors
    } = useForm<ExampleFormSchema>({
        resolver: zodResolver(exampleFormSchema)
    });

    const onSubmit = async (data: ExampleFormSchema) => {
        clearErrors();
        setSubmitSuccess(false);
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('email', data.email);

        const result = await exampleFormAction(formData);

        if (result.success) {
            reset();
            setSubmitSuccess(true);
            return;
        }

        if (result.fieldErrors) {
            for (const [field, message] of Object.entries(result.fieldErrors)) {
                if (field === 'name' || field === 'email') {
                    setError(field, { message });
                }
            }
        }
        if (result.error) {
            setError('root.serverError', { message: result.error });
        } else if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
            setError('root.serverError', { message: tErrors('validation.failed') });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {submitSuccess && (
                <p className="text-sm text-muted-foreground" role="status">
                    {tCommon('form.submittedSuccessfully')}
                </p>
            )}
            {errors.root?.serverError && (
                <p className="text-sm text-destructive" role="alert">
                    {errors.root.serverError.message}
                </p>
            )}
            <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium">
                    {tCommon('form.name')}
                </label>
                <Input
                    id="name"
                    {...register('name')}
                    placeholder={tCommon('form.enterName')}
                    aria-invalid={errors.name ? 'true' : 'false'}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                    <p id="name-error" className="mt-1 text-sm text-destructive" role="alert">
                        {errors.name.message}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium">
                    {tCommon('form.email')}
                </label>
                <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder={tCommon('form.enterEmail')}
                    aria-invalid={errors.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                    <p id="email-error" className="mt-1 text-sm text-destructive" role="alert">
                        {errors.email.message}
                    </p>
                )}
            </div>

            <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Send className="size-4" aria-hidden="true" />
                    )}
                    {isSubmitting ? tCommon('form.submitting') : tCommon('button.submit')}
                </Button>
                <Button type="button" variant="outline" onClick={() => reset()}>
                    {tCommon('button.reset')}
                </Button>
            </div>
        </form>
    );
};
