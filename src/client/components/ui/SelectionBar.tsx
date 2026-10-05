import React, { useCallback, useMemo } from 'react';
import { X } from '@phosphor-icons/react/X';
import { cn } from '../../lib/cn';
import { FloatingSurface } from './FloatingSurface';
import { Button } from './Button';
/**
 * Selection state, once. Six components used to keep their own
 * `useState<Set<string>>` plus hand-rolled toggle/toggleAll/clear, which is how
 * "select all" quietly disagreed with the row checkboxes in four of them.
 */
export interface Selection {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  count: number;
  isSelected: (id: string) => boolean;
}

export function useSelection(initial?: Iterable<string>): Selection {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(initial ?? []));

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return useMemo(
    () => ({ selected, toggle, toggleAll, clear, count: selected.size, isSelected }),
    [selected, toggle, toggleAll, clear, isSelected]
  );
}

export interface SelectionBarProps {
  count: number;
  /** Rendered under the counter when the page knows its full unfiltered size. */
  totalCount?: number;
  onClear: () => void;
  /** Omit when the surface cannot select everything (e.g. a filtered page). */
  onToggleAll?: () => void;
  isAllSelected?: boolean;
  children?: React.ReactNode;
  itemLabel?: string;
  className?: string;
}

/**
 * The "N dipilih" bar. Rendered through `FloatingSurface` so the z-layer and
 * the "clears the mobile dock" offset are decided once; `BulkActionBar` is a
 * thin consumer that only supplies the action buttons.
 */
export const SelectionBar: React.FC<SelectionBarProps> = ({
  count,
  totalCount,
  onClear,
  onToggleAll,
  isAllSelected = false,
  children,
  itemLabel = 'Item',
  className,
}) => {
  if (count === 0) return null;

  return (
    <FloatingSurface
      placement="bottom-bar"
      offsetClass="bottom-[calc(6.5rem+env(safe-area-inset-bottom))] sm:bottom-0 px-3 sm:left-64 sm:px-6"
      className={cn('mx-auto flex max-w-4xl items-center justify-between gap-2', className)}
    >
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-ink font-oxanium text-xs font-bold tabular-nums text-paper">
          {count}
        </span>
        <span className="shrink-0 text-xs font-semibold leading-tight text-ink">
          <span className="hidden sm:inline">{count} {itemLabel} </span>
          Terpilih
          {totalCount !== undefined && (
            <span className="hidden whitespace-nowrap text-[10px] font-normal text-ink-3 sm:block">
              dari total {totalCount} {itemLabel}
            </span>
          )}
        </span>

        {onToggleAll && (
          <Button
            size="sm"
            variant="ghost"
            className="hidden shrink-0 whitespace-nowrap sm:inline-flex"
            aria-pressed={isAllSelected}
            onClick={onToggleAll}
          >
            {isAllSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
          </Button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:ml-auto sm:gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto overscroll-contain no-scrollbar sm:justify-end">
          {children}
        </div>

        {onToggleAll && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 px-2.5 py-1 text-xs sm:hidden"
            aria-pressed={isAllSelected}
            onClick={onToggleAll}
          >
            {isAllSelected ? 'Batal' : 'Semua'}
          </Button>
        )}

        <button
          type="button"
          onClick={onClear}
          aria-label="Batal Memilih"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-chip border border-rule bg-paper-raised text-ink-2 hover:bg-paper-sunk hover:text-ink sm:h-10 sm:w-10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
          )}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </FloatingSurface>
  );
};