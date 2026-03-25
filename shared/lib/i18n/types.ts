import type { Namespace } from './constants';

export type TranslationKey = `${Namespace}:${string}`;

export interface TranslationResources {
    [key: string]: Record<string, string | Record<string, string>>;
}
