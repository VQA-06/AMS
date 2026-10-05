import React from 'react';
import { cn } from '../../lib/cn';
import type { MarkTone } from './Table';
import { markFillClass } from './Card';

export type FloatingPlacement = 'bottom-bar' | 'top-bar' | 'bottom-sheet';

export interface FloatingSurfaceProps {
  children: React.ReactNode;
  placement: FloatingPlacement;
  /** Only when the surface's state genuinely varies; constant hue is decoration. */
  mark?: MarkTone;
  /** Extra offset for callers that must clear the mobile dock. */
  offsetClass?: string;
  className?: string;
  /**
   * Whether the surface is showing at all. Defaults to true so a bar that owns
   * its own presence (bulk bar, scan toast, install banner) needs no flag.
   * A collapsible surface passes its open state, because a collapsed sheet must
   * not paint a backdrop over the page it is sitting on.
   */
  open?: boolean;
}

/**
 * One fixed-overlay primitive for every transient surface — bulk action bar,
 * scan toast, install banner, recent-scans sheet. Owns the z-layer, the
 * safe-area padding, and the scrim decision, so no component can escape the
 * stacking order or slide under the dock.
 *
 * `bottom-bar` and `top-bar` sit above the dock (`z-bar`) but below modals and
 * paint **no** backdrop: they are bars over a live page, and dimming that page
 * reads as a modal. `bottom-sheet` covers the page, so it alone owns the scrim;
 * it also clears `pb-safe` and is an opaque rule-bordered bar on paper, never a
 * floating dark pill.
 */
export const FloatingSurface: React.FC<FloatingSurfaceProps> = ({
  children,
  placement,
  mark,
  offsetClass,
  className,
  open = true,
}) => {
  if (!open) return null;

  return (
    <>
      {/* Backdrop: a scrim only for the sheet, which covers the page and owns
          it. A bar or a toast sits *on* the page, so dimming the page behind
          it reads as "a modal opened" — that was the "black background during
          multi-select" report. Bars and toasts stay click-through either way;
          never re-add `pointer-events` to a backdrop. Not focusable; Escape
          and click-through both belong to the surface's owner. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed inset-0 z-bar bg-ink/40',
          placement !== 'bottom-sheet' && 'hidden'
        )}
      />
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto fixed inset-x-0 z-bar',
          placement === 'top-bar' && 'top-0',
          placement !== 'top-bar' && 'bottom-0',
          placement === 'bottom-sheet' && 'pb-safe',
          offsetClass
        )}
      >
        <div
          className={cn(
            'mx-auto flex w-full items-center gap-2 border border-rule bg-paper-raised px-3 py-2',
            placement === 'top-bar'
              ? 'rounded-b-panel'
              : placement === 'bottom-bar'
              ? 'rounded-panel sm:rounded-t-panel sm:rounded-b-none sm:border-b-0'
              : 'rounded-t-panel',
            className
          )}
        >
          {mark && <span aria-hidden="true" className={cn('h-4 w-0.5 shrink-0', markFillClass[mark])} />}
          <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        </div>
      </div>
    </>
  );
};