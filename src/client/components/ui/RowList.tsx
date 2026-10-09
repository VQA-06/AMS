import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/cn';
import { markTextClass, markToneClass, type MarkTone } from './Table';
import { Pagination } from './Pagination';
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
  /**
   * Subset of `items` that may be selected. Present when some rows are locked
   * (the signed-in account, the default master owner): a locked row renders the
   * muted `-` fragment instead of a checkbox, so the selection guard stays
   * visible rather than becoming an inert control.
   */
  selectableIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  emptyState?: React.ReactNode;
  className?: string;
  itemLabel?: string;
  /** Number of items per page. Defaults to 25. */
  pageSize?: number;
  /** Whether pagination is enabled. Defaults to true. */
  paginated?: boolean;
  /** Controlled page index (1-based). Optional. */
  page?: number;
  /** Callback on page change. Optional. */
  onPageChange?: (page: number) => void;
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
  selectableIds,
  onToggle,
  onToggleAll,
  emptyState,
  className,
  itemLabel = 'baris',
  pageSize = 25,
  paginated = true,
  page,
  onPageChange,
}) => {
  const [internalPage, setInternalPage] = useState(1);
  const effectivePageSize = pageSize;
  const totalPages = Math.max(1, Math.ceil(items.length / effectivePageSize));
  const activePage = Math.max(1, Math.min(page ?? internalPage, totalPages));
  const handlePageChange = onPageChange ?? setInternalPage;

  useEffect(() => {
    if (internalPage > totalPages) {
      setInternalPage(totalPages);
    }
  }, [internalPage, totalPages]);
  const tones = new Set(items.map((item) => item.status?.tone).filter(Boolean) as MarkTone[]);
  const mixedTones = tones.size > 1;

  if (items.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  const selectableCount = selectableIds
    ? items.filter((item) => selectableIds.has(item.id)).length
    : items.length;
  const allSelected =
    selectable && selectedIds ? selectedIds.size === selectableCount && selectableCount > 0 : false;

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
            {`Pilih semua (${selectableCount} ${itemLabel})`}
          </span>
        </label>
      )}
      <ul>
        {(paginated && items.length > effectivePageSize
          ? items.slice((activePage - 1) * effectivePageSize, activePage * effectivePageSize)
          : items
        ).map((item) => {
          const tone = item.status?.tone;
          const showMark = mixedTones && tone !== undefined && tone !== 'idle';
          const selected = selectedIds?.has(item.id) ?? false;
          const rowSelectable = selectable && (!selectableIds || selectableIds.has(item.id));

          const content = (
            <>
              {selectable ? (
                rowSelectable ? (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle?.(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Pilih ${item.title}`}
                    className="h-4 w-4 shrink-0 accent-pen-500"
                  />
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs text-ink-3">-</span>
                )
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
                {(item.meta || item.status) && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                    {item.meta && <span className="min-w-0 flex-1 truncate text-ink-3">{item.meta}</span>}
                    {item.status && (
                      <span
                        className={cn(
                          'shrink-0 whitespace-nowrap font-display uppercase tracking-[0.1em] sm:hidden',
                          markTextClass[item.status.tone]
                        )}
                      >
                        {item.status.label}
                      </span>
                    )}
                  </span>
                )}
              </span>
              {item.status && (
                <span
                  className={cn(
                    'hidden shrink-0 whitespace-nowrap font-display text-[11px] uppercase tracking-[0.1em] sm:flex',
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
            'flex min-h-[56px] w-full items-center gap-2 px-3 py-3 text-left transition-colors duration-120 ease-out-expo sm:gap-4 sm:px-4',
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
      {paginated && (
        <Pagination
          currentPage={activePage}
          totalItems={items.length}
          pageSize={effectivePageSize}
          onPageChange={handlePageChange}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
};