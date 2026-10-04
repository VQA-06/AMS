import React from 'react';
import { cn } from '../../lib/cn';

/**
 * The state mark: a 2px left border on the leading cell, not a filled rail.
 * A ledger separates entries with a hairline and marks the ones that vary with
 * a thin stroke of ink; it does not float colored bars beside them.
 *
 * It is drawn as a border on the leading `<td>` because a `<span>` cannot be a
 * child of `<tr>`, and the border must sit on that `<td>` itself: CSS cannot
 * reach it from the row, since a `[&>*…]` variant compiles to a grandchild
 * selector that never matches a cell.
 */
export type MarkTone = 'seal' | 'pen' | 'pending' | 'danger' | 'info' | 'idle';

export const markToneClass: Record<MarkTone, string> = {
  seal: 'border-l-seal-500',
  pen: 'border-l-pen-500',
  pending: 'border-l-pending-500',
  danger: 'border-l-danger-500',
  info: 'border-l-info-500',
  idle: 'border-l-rule-strong',
};

/** The text hue for a mark tone. `idle` is ink-3 (5.00:1), never rule-strong. */
export const markTextClass: Record<MarkTone, string> = {
  seal: 'text-seal-600',
  pen: 'text-pen',
  pending: 'text-pending-600',
  danger: 'text-pen-deep',
  info: 'text-info-600',
  idle: 'text-ink-3',
};

/**
 * One table frame for the app. `Table` owns the `overflow-x-auto` container
 * and the sticky `<thead>`, so no page can ship a table that scrolls the page
 * sideways or loses its header on a long list. Tables stay where columns
 * genuinely compare (roster, team, audit); index-card rows own the scrolling
 * lists.
 */
export const Table: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
    </div>
  );
};

export const THead: React.FC<{
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}> = ({ children, className, sticky = true }) => {
  return (
    <thead
      className={cn(
        'bg-paper-sunk text-[10px] uppercase tracking-wider text-ink-3',
        sticky && 'sticky top-0 z-sticky',
        '[&_tr]:border-b [&_tr]:border-rule-strong',
        className
      )}
    >
      {children}
    </thead>
  );
};

/**
 * Rows carry their own `border-b` rather than `divide-y`: `divide-y` skips the
 * last row, and a ledger without a closing rule is not a ledger.
 */
export const TBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <tbody className={cn(className)}>{children}</tbody>;

export const TRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  /**
   * A mark is only legitimate when the hue varies by row — that is what makes
   * it information rather than decoration.
   */
  mark?: MarkTone;
}> = ({ children, className, onClick, selected, mark }) => {
  const cells = React.Children.toArray(children);
  const markClass = mark ? `border-l-2 ${markToneClass[mark]}` : undefined;
  return (
    <tr
      onClick={onClick}
      data-mark={mark}
      className={cn(
        'border-b border-rule last:border-b-0 transition-colors duration-120 ease-out-expo',
        onClick && 'cursor-pointer hover:bg-paper-sunk/60',
        selected && 'bg-paper-sunk',
        className
      )}
    >
      {cells.map((cell, i) =>
        i === 0 && markClass && React.isValidElement(cell)
          ? React.cloneElement(cell as React.ReactElement<{ className?: string }>, {
              className: cn(markClass, (cell as React.ReactElement<{ className?: string }>).props.className),
            })
          : cell
      )}
    </tr>
  );
};

export const TCell: React.FC<{
  children?: React.ReactNode;
  className?: string;
  header?: boolean;
  colSpan?: number;
  truncate?: boolean;
}> = ({ children, className, header = false, colSpan, truncate = false }) => {
  const Tag = header ? 'th' : 'td';
  return (
    <Tag
      colSpan={colSpan}
      scope={header ? 'col' : undefined}
      className={cn(
        'px-3 py-2.5 align-middle sm:px-4 sm:py-3',
        header && 'text-left font-bold',
        // Long text must never stretch the layout.
        truncate && 'max-w-[16rem] truncate',
        className
      )}
    >
      {children}
    </Tag>
  );
};