import React from 'react';
import { cn } from '../../lib/cn';
import { type MarkTone } from './Table';

export type { MarkTone } from './Table';

/**
 * The fill form of a mark, for surfaces that paint a `<span>` (a card's
 * leading stroke, a floating bar's tab). `markToneClass` in `Table` is the
 * *border* form, because a `<span>` is not a valid child of `<tr>` — reusing
 * the border map on a fill is what previously tinted whole table rows.
 */
export const markFillClass: Record<MarkTone, string> = {
  seal: 'bg-seal-500',
  pen: 'bg-pen-500',
  pending: 'bg-pending-500',
  danger: 'bg-pen-500',
  info: 'bg-info-500',
  idle: 'bg-rule-strong',
};

/**
 * The card surface: paper-raised on a 1px rule. Depth comes from the hairline
 * and the ink, never from a shadow — a ledger does not float.
 *
 * `mark` is a 2px leading stroke, opt-in only for surfaces whose state actually
 * varies. A mark whose color is constant for a given surface is decoration.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  mark?: MarkTone;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, mark, className, ...props }) => {
  return (
    <div className={cn('rounded-panel border border-rule bg-paper-raised', className)} {...props}>
      <div className="flex gap-0 overflow-hidden rounded-panel">
        {mark && (
          <>
            {/* Invisible to assistive tech: the mark restates what the row's
                text or badge already says, so announcing it twice is noise. */}
            <span aria-hidden="true" data-mark={mark} className={cn('w-0.5 shrink-0 self-stretch', markFillClass[mark])} />
            <span aria-hidden="true" className="w-3 shrink-0" />
          </>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
};