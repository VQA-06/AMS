import React from 'react';
import { cn } from '../../lib/cn';
import { Card } from './Card';
import type { MarkTone } from './Table';

export interface StatProps {
  label: string;
  value: React.ReactNode;
  /** Only pass when the figure's meaning differs by state; constant hue is decoration. */
  mark?: MarkTone;
  hint?: string;
  icon?: React.ReactNode;
  /**
   * The section backing this figure failed to load. The figure renders as a
   * dash with a "Gagal dimuat" hint — never `0`, because a plausible zero in
   * an attendance book is a false statement about who was present.
   */
  failed?: boolean;
  className?: string;
}

/** One KPI figure. Fraunces + tabular-nums so a count never shifts as it updates. */
export const Stat: React.FC<StatProps> = ({ label, value, mark, hint, icon, failed, className }) => {
  return (
    <Card mark={failed ? undefined : mark} className={cn('p-3.5 sm:p-4', className)}>
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">
            {icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
            <span className="truncate">{label}</span>
          </div>
          {failed ? (
            <>
              <p className="mt-1.5 font-display text-2xl font-semibold leading-none tabular-nums text-ink-3 sm:text-3xl">
                —
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-3">Gagal dimuat</p>
            </>
          ) : (
            <>
              <p className="mt-1.5 font-display text-2xl font-semibold leading-none tabular-nums text-ink sm:text-3xl">
                {value}
              </p>
              {hint && <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{hint}</p>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
};