import React, { useEffect, useId, useRef, useState } from 'react';
import { DotsThree } from '@phosphor-icons/react/DotsThree';
import { cn } from '../../lib/cn';

export interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  tone?: 'neutral' | 'danger';
}

export interface RowActionsProps {
  /** The trigger's `aria-label` — the row this menu belongs to, e.g. "Menu Farhan". */
  label: string;
  items: RowActionItem[];
  /** Which edge the panel hugs. Rows sit at the right rail, so `end` is the default. */
  align?: 'start' | 'end';
  className?: string;
}

/**
 * The row's overflow menu — the mobile owner of whatever a row can do.
 *
 * The row itself has no room for five 44px buttons at 344px: the inline
 * cluster pushed the last one past the viewport edge, and the title had zero
 * width left over. Below `sm` the buttons collapse into this kebab; at `sm` and
 * up the row keeps its inline buttons, so this is hidden there and there is no
 * `matchMedia`, no hydration split, and one render path for the data.
 *
 * The panel is `absolute` inside a wrapper that sits beside the row, never
 * inside the row's own `<button>` — a menu trigger inside a button is a nested
 * interactive, which the app forbids. Rows live in the SPA scroll host, so the
 * panel travels with its row and needs no scroll listener; a page-level portal
 * would detach it and demand repositioning on every scroll event.
 *
 * It is deliberately not a modal: no scroll lock, no focus trap. `Tab` walks the
 * items and then leaves, which is the correct affordance for a menu bound to a
 * row rather than to the page.
 */
export const RowActions: React.FC<RowActionsProps> = ({ label, items, align = 'end', className }) => {
  const [open, setOpen] = useState(false);
  /** Rows in the lower third open upward so the panel is not clipped by the list. */
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Focus the first item on open so a keyboard user lands inside the menu, and
  // returns to the trigger on close so the row context is not lost.
  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setDropUp(rect.top > window.innerHeight * 0.66);
    }
    setOpen((prev) => !prev);
  };

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        className={cn(
          'touch-target rounded-chip text-ink-2 transition-colors duration-120 ease-out-expo hover:bg-paper-sunk hover:text-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
        )}
      >
        <DotsThree size={20} weight="bold" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-popover min-w-[168px] rounded-chip border border-rule-strong bg-paper-raised py-1 shadow-lg',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-xs font-semibold transition-colors duration-120 ease-out-expo',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pen-500',
                item.tone === 'danger'
                  ? 'text-pending-700 hover:bg-pending-50'
                  : 'text-ink-2 hover:bg-paper-sunk hover:text-ink'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};