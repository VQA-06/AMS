import React from 'react';
import { cn } from '../../lib/cn';
import { markTextClass, markToneClass, type MarkTone } from './Table';

export type { MarkTone } from './Table';

export interface RowListItem {
  id: string;
  /** Display heading — member name, event name. */
  title: string;
  /** Second line — division, `location_name` + date range. */
  meta?: string;
  /** Right-aligned state word. Real text, never a colored dot with no word. */
  status?: { label: string; tone: MarkTone };
  /** Ordinal within the current result set, e.g. "01". Display-only. */
  leading?: string;
  /** Optional interactive element (a row action button). */
  action?: React.ReactNode;
}

export interface RowListProps {
  items: RowListItem[];
  onSelect?: (id: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  emptyState?: React.ReactNode;
  className?: string;
  itemLabel?: string;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/**
 * The index-card row grammar: an entry in the ledger book, not a row in a
 * column table.
 *
 * Members, Events, and Tracker all list things that are *read one at a time* —
 * a person, an event, a tier — so a row has two lines and a state word. A
 * table would force every one of those into a column, and on a 360px phone a
 * table's only real affordance is horizontal scroll. This row is full-width,
 * already two lines, and never scrolls sideways.
 *
 * The mark (`border-l-2`) is painted only when the list's status actually
 * varies: a homogeneous list gets no marks at all, because a constant mark is
 * decoration. The state word is present as text at every tone, including
 * `idle`, so a grayscale print of the list is fully readable.
 */
export const RowList: React.FC<RowListProps> = ({
  items,
  onSelect,
  selectable = false,
  selectedIds,
  onToggle,
  onToggleAll,
  emptyState,
  className,
  itemLabel = 'baris',
}) => {
  const tones = new Set(items.map((item) => item.status?.tone).filter(Boolean) as MarkTone[]);
  const mixedTones = tones.size > 1;

  if (items.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  const allSelected = selectable && selectedIds ? selectedIds.size === items.length : false;

  return (
    <div className={cn('rounded-panel border border-rule bg-paper-raised', className)}>
      {selectable && onToggleAll && (
        <label className="flex items-center gap-2.5 border-b border-rule px-4 py-2.5 text-[11px] text-ink-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            className="h-4 w-4 shrink-0 accent-pen-500"
          />
          <span>
            Pilih semua ({items.length} {itemLabel})
          </span>
        </label>
      )}
      <ul>
        {items.map((item) => {
          const tone = item.status?.tone;
          const showMark = mixedTones && tone !== undefined && tone !== 'idle';
          const selected = selectedIds?.has(item.id) ?? false;

          const content = (
            <>
              {selectable ? (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle?.(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Pilih ${item.title}`}
                  className="h-4 w-4 shrink-0 accent-pen-500"
                />
              ) : (
                item.leading && (
                  <span className="w-6 shrink-0 font-oxanium text-[11px] tabular-nums text-ink-3">
                    {item.leading}
                  </span>
                )
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[15px] leading-tight text-ink">
                  {item.title}
                </span>
                {item.meta && <span className="mt-0.5 block truncate text-[11px] text-ink-3">{item.meta}</span>}
              </span>
              {item.status && (
                <span
                  className={cn(
                    'shrink-0 whitespace-nowrap font-display text-[11px] uppercase tracking-[0.1em]',
                    markTextClass[item.status.tone]
                  )}
                >
                  {item.status.label}
                </span>
              )}
              {item.action && (
                <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  {item.action}
                </span>
              )}
            </>
          );

          const rowClass = cn(
            'flex min-h-[56px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-120 ease-out-expo',
            showMark && `border-l-2 ${markToneClass[tone as MarkTone]}`,
            selected && 'bg-paper-sunk',
            !selected && onSelect && 'hover:bg-paper-sunk/60'
          );

          return (
            // The status hue is part of the rendered contract: `TRow` and
            // `Card` expose it the same way, so colour-semantics tests read
            // one attribute off all three list surfaces.
            <li key={item.id} data-mark={tone} className="ledger-row">
              {onSelect ? (
                <button type="button" onClick={() => onSelect(item.id)} className={cn(rowClass, focusRing)}>
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};