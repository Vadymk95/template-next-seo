/**
 * DEV-only content-variance fixture. The input to `e2e/dev/content-stress.spec.ts`, which measures each
 * primitive against content it has NOT seen at five viewport widths.
 *
 * Why it exists: every primitive here was only ever proven against one string length, and jsdom has no
 * layout, so a unit test can pin a class string and nothing more. The defects that escape are the other
 * lengths — a label that overflows its box, a control that wraps into a 12-character column, a single
 * unbroken token that pushes the page sideways.
 *
 * Where a fix belongs: primitive cases (`Button`, `IconButton`, `Field`) guard the shipped kit and their
 * fixes go in `shared/ui/*`. Composition cases (`ButtonRow`, `FeatureList`, `Prose`) guard a layout IDIOM,
 * so the fix is the idiom here and is then copied into the page that needs it.
 *
 * `app/dev/ui/layout.tsx` returns `notFound()` in production and marks the segment `noindex`, and
 * `proxy.ts` answers 404 for `/dev/*` there as well, so this never becomes a public surface.
 */
import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { routing } from '@/i18n/routing';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import {
    CONTENT_STRESS_CASES,
    CONTENT_STRESS_TOTAL,
    resolveItemCount,
    transformText,
    type ContentStressComponent
} from './stressMatrix';

interface CaseProps {
    component: ContentStressComponent;
    heading: string;
    iconLabel: string;
    itemCount: number;
    /**
     * A CHROME label: short by contract, because `Button`'s base variant keeps `whitespace-nowrap`.
     * Separate from `text` on purpose — feeding a paragraph here measures the wrong thing and reads as
     * a broken primitive. Sentence-length content in a button is the `ButtonRow` case, which renders the
     * documented multi-line override.
     */
    label: string;
    message: string;
    /** Prose: a real sentence, which is what a paragraph or a list item actually carries. */
    text: string;
}

const renderCase = ({
    component,
    heading,
    iconLabel,
    itemCount,
    label,
    message,
    text
}: CaseProps): ReactElement => {
    switch (component) {
        case 'Button':
            return <Button>{label}</Button>;
        case 'ButtonRow':
            /*
             * The IDIOM for a button that may carry a sentence, and the reason the base variant is not
             * changed to match. `Button` keeps `whitespace-nowrap` because chrome labels must never break
             * across lines. A consumer whose label is real content opts out here: `whitespace-normal` to
             * allow wrapping at all, `h-auto min-h-10` so a second line is not clipped by the fixed
             * height, and `min-w-0` on the label so the flex item can shrink below its longest word.
             */
            return (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button
                        variant="secondary"
                        className="h-auto min-h-10 min-w-0 whitespace-normal"
                    >
                        <span className="min-w-0 wrap-anywhere">{label}</span>
                    </Button>
                    <Button variant="outline" className="h-auto min-h-10 min-w-0 whitespace-normal">
                        <span className="min-w-0 wrap-anywhere">{label}</span>
                    </Button>
                </div>
            );
        case 'IconButton':
            return (
                <Button variant="ghost" size="icon" aria-label={`${iconLabel} ${label}`}>
                    <Check className="size-4" />
                </Button>
            );
        case 'Field':
            return (
                <div className="space-y-2">
                    <label className="text-sm leading-none font-medium" htmlFor="stress-field">
                        {label}
                    </label>
                    <Input id="stress-field" placeholder={label} defaultValue={text} />
                    <p className="text-sm text-destructive" role="alert">
                        {message}
                    </p>
                </div>
            );
        case 'Prose':
            return (
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{heading}</h3>
                    <p className="text-sm text-muted-foreground">{text}</p>
                </div>
            );
        case 'FeatureList':
            return (
                <ul className="space-y-1">
                    {Array.from(
                        { length: itemCount },
                        (_, index) => `${text} ${String(index)}`
                    ).map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                            <Check className="size-4 shrink-0" aria-hidden="true" />
                            {/*
                             * `min-w-0` is load-bearing, not decoration: a flex item's default
                             * `min-width: auto` floors it at its longest unbreakable word, so
                             * `overflow-wrap` in the base layer cannot save it on its own.
                             */}
                            <span className="min-w-0">{item}</span>
                        </li>
                    ))}
                </ul>
            );
    }
};

export const ContentStressPage = async (): Promise<ReactElement> => {
    const locale = routing.defaultLocale;
    const home = await getTranslations({ locale, namespace: 'home' });
    const errors = await getTranslations({ locale, namespace: 'errors' });
    const common = await getTranslations({ locale, namespace: 'common' });

    // Real authored copy, never lorem-ipsum: the transform starts from a string the product ships, so
    // the TYPICAL state is genuinely typical and the LONG state is a real string tripled.
    const sourceText = home('description');
    const sourceLabel = common('button.submit');
    const sourceHeading = home('title');
    const sourceMessage = errors('validation.maxLength');
    const iconLabel = common('button.submit');

    return (
        <div
            className="container mx-auto max-w-4xl min-w-0 space-y-6 p-8"
            data-stress-root
            data-stress-components={CONTENT_STRESS_CASES.length}
            data-stress-total={CONTENT_STRESS_TOTAL}
        >
            <div className="space-y-2">
                <h1 className="text-3xl font-bold">{sourceHeading}</h1>
                <p className="text-muted-foreground">{sourceText}</p>
            </div>

            <div className="grid min-w-0 gap-6">
                {CONTENT_STRESS_CASES.flatMap(({ component, states }) =>
                    states.map((state) => (
                        <article
                            key={`${component}-${state}`}
                            className="min-w-0 rounded-lg border border-border p-4"
                            data-stress-case
                            data-stress-component={component}
                            data-stress-state={state}
                        >
                            <p className="mb-3 text-xs text-muted-foreground">
                                {`${component} · ${state}`}
                            </p>
                            <div className="min-w-0" data-stress-target>
                                {renderCase({
                                    component,
                                    heading: transformText(sourceHeading, state),
                                    iconLabel,
                                    itemCount: resolveItemCount(state),
                                    label: transformText(sourceLabel, state),
                                    message: transformText(sourceMessage, state),
                                    text: transformText(sourceText, state)
                                })}
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
};
