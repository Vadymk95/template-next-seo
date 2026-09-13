import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

const INSIDE = [
    'next',
    'intl',
    'styling',
    'state',
    'boundary',
    'security',
    'vitals',
    'testing'
] as const;
const FLOW = ['iterate', 'commit', 'push', 'ci'] as const;
const COMMANDS = ['onboard', 'feat', 'test', 'review', 'docs'] as const;
const READING = [
    ['index', '.cursor/brain/READING_INDEX.md'],
    ['map', '.cursor/brain/MAP.md'],
    ['skeletons', '.cursor/brain/SKELETONS.md'],
    ['verification', '.cursor/brain/VERIFICATION.md'],
    ['decisions', '.cursor/brain/DECISIONS.md']
] as const;
const STEPS = [
    ['prepare', 'npm run prepare'],
    ['dev', 'npm run dev'],
    ['iter', 'npm run verify:iter']
] as const;

const CARD = 'rounded-lg border bg-card p-4 text-sm text-card-foreground';
const CODE = 'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] break-all';

type SectionProps = { id: string; title: string; children: ReactElement };

const Section = ({ id, title, children }: SectionProps): ReactElement => (
    <section aria-labelledby={id} className="mt-10">
        <h2 id={id} className="text-xl font-semibold tracking-tight">
            {title}
        </h2>
        {children}
    </section>
);

/**
 * The start page: what the template ships, how work flows through the gate, which agent commands
 * exist and where to read next. A server component (no client island) — the template seed a fork
 * replaces with its first real route. Copy lives in `messages/<locale>.json` under `home`.
 */
export const StartPage = (): ReactElement => {
    const t = useTranslations('home');

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
                <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{t('description')}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('seed')}</p>
            </header>

            <Section id="inside" title={t('inside.title')}>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {INSIDE.map((key) => (
                        <li key={key} className={CARD}>
                            {t(`inside.${key}`)}
                        </li>
                    ))}
                </ul>
            </Section>

            <Section id="flow" title={t('flow.title')}>
                <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {FLOW.map((key) => (
                        <li key={key} className={CARD}>
                            <h3 className="font-semibold">{t(`flow.${key}.title`)}</h3>
                            <p className="mt-1 text-muted-foreground">{t(`flow.${key}.text`)}</p>
                        </li>
                    ))}
                </ol>
            </Section>

            <Section id="agents" title={t('agents.title')}>
                <div className="mt-4 space-y-4">
                    <p className="text-sm">
                        <code className={CODE}>AGENTS.md</code> — {t('agents.lead')}
                    </p>
                    <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-6">
                        {COMMANDS.map((key) => (
                            <div key={key} className="contents">
                                <dt>
                                    <code className={CODE}>/{key}</code>
                                </dt>
                                <dd className="text-sm text-muted-foreground">
                                    {t(`agents.commands.${key}`)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <p className="text-sm text-muted-foreground">
                        {t('agents.spec')} <code className={CODE}>.cursor/templates/</code>
                    </p>
                </div>
            </Section>

            <Section id="reading" title={t('reading.title')}>
                <dl className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-6">
                    {READING.map(([key, path]) => (
                        <div key={key} className="contents">
                            <dt>
                                <code className={CODE}>{path}</code>
                            </dt>
                            <dd className="text-sm text-muted-foreground">{t(`reading.${key}`)}</dd>
                        </div>
                    ))}
                </dl>
            </Section>

            <Section id="steps" title={t('steps.title')}>
                <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm">
                    {STEPS.map(([key, command]) => (
                        <li key={key}>
                            <code className={CODE}>{command}</code> — {t(`steps.${key}`)}
                        </li>
                    ))}
                    <li>{t('steps.graduate')}</li>
                </ol>
            </Section>
        </div>
    );
};
