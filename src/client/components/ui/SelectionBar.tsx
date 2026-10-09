import React, { useCallback, useMemo } from 'react';
import { X } from '@phosphor-icons/react/X';
import { cn } from '../../lib/cn';
import { FloatingSurface } from './FloatingSurface';
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
  onClear: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * The selection bar: a clear button and the actions a page offers. Rendered
 * through `FloatingSurface` so the z-layer and the "clears the mobile dock"
 * offset are decided once; `BulkActionBar` is a thin consumer that only
 * supplies the buttons.
 *
 * It carries no counter. "Select all" already exists as a row-list checkbox
 * above the rows it applies to, so the bar's own count chip, "N dipilih" line
 * and select-all button were a second, redundant way to read the same state —
 * and at 344px they were what pushed the last action off-screen.
 */
export const SelectionBar: React.FC<SelectionBarProps> = ({ count, onClear, children, className }) => {
  if (count === 0) return null;

  return (
    <FloatingSurface
      placement="bottom-bar"
      offsetClass="bottom-[calc(6.5rem+env(safe-area-inset-bottom))] sm:bottom-0 px-3 sm:left-64 sm:px-6"
      className={cn('mx-auto flex max-w-4xl items-center justify-between gap-2', className)}
    >
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        {/* Actions scroll rather than overflow: at 344px four buttons are wider
            than the bar, and a button pushed past the viewport edge is a
            feature nobody can reach. `snap-x` keeps them from parking
            mid-button. */}
        <div className="flex min-w-0 flex-1 snap-x items-center gap-1.5 overflow-x-auto overscroll-contain no-scrollbar sm:justify-end">
          {children}
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Batal Memilih"
          className={cn(
            'flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-chip border border-rule bg-paper-raised text-ink-2 hover:bg-paper-sunk hover:text-ink',
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