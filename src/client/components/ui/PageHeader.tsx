import React from 'react';
import { cn } from '../../lib/cn';
import { markToneClass, type MarkTone } from './Table';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Renders a back affordance before the title block. */
  back?: React.ReactNode;
  /** Optional leading mark, only when the page's state genuinely varies. */
  mark?: MarkTone;
  className?: string;
}

/**
 * The one page header. Nine pages used to hand-roll their own, which is why the
 * title block could not be fixed in a single place.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  back,
  mark,
  className,
}) => {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {back && <span className="shrink-0">{back}</span>}
        {mark && (
          <>
            <span aria-hidden="true" className={cn('mt-1 w-0.5 shrink-0 self-stretch', markToneClass[mark])} />
            <span aria-hidden="true" className="w-2 shrink-0" />
          </>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-tight tracking-tight text-ink sm:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-xs text-ink-3 sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
};