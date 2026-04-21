'use client';

import type { ComponentProps, MouseEvent } from 'react';

import { Link, usePathname } from '@/i18n/navigation';

type SmartLinkProps = ComponentProps<typeof Link>;

// NOTE: pathname-only comparison. Query/hash are ignored — `useSearchParams` would
// force a Suspense bailout on every static route that renders Header/Footer.
// Use a plain `Link` for query/hash-sensitive navigation.
const extractPathname = (href: SmartLinkProps['href']): string => {
    if (typeof href === 'string') {
        const [pathname = ''] = href.split('?');
        const [cleanPath = ''] = pathname.split('#');
        return cleanPath;
    }
    return href.pathname ?? '';
};

export const SmartLink = ({ href, onClick, ...rest }: SmartLinkProps) => {
    const pathname = usePathname();
    const isActive = pathname === extractPathname(href);

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        const isModifiedClick =
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
        if (isActive && !isModifiedClick && !event.defaultPrevented) {
            event.preventDefault();
        }
        onClick?.(event);
    };

    return (
        <Link
            {...rest}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            onClick={handleClick}
        />
    );
};
