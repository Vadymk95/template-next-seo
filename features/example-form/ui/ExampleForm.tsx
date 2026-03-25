'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { exampleFormAction } from '@/app/actions/example-form';
import { Button, Input } from '@/shared/ui';

import { exampleFormSchema, type ExampleFormSchema } from '../model/schema';

export const ExampleForm: FC = () => {
    const { t } = useTranslation(['common', 'errors']);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset
    } = useForm<ExampleFormSchema>({
        resolver: zodResolver(exampleFormSchema)
    });

    const onSubmit = async (data: ExampleFormSchema) => {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('email', data.email);

        const result = await exampleFormAction(formData);

        if (result.success) {
            reset();
            alert(t('common:form.submittedSuccessfully'));
        } else {
            alert(`${t('errors:validation.failed')}: ${result.error}`);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium">
                    {t('common:form.name')}
                </label>
                <Input
                    id="name"
                    {...register('name')}
                    placeholder={t('common:form.enterName')}
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
                    {t('common:form.email')}
                </label>
                <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder={t('common:form.enterEmail')}
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
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t('common:form.submitting') : t('common:button.submit')}
                </Button>
                <Button type="button" variant="outline" onClick={() => reset()}>
                    {t('common:button.reset')}
                </Button>
            </div>
        </form>
    );
};
