import React from 'react';
import { cn } from '../../lib/cn';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  className?: string;
  ariaLabel?: string;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

// Segments share the switcher's width, so a two-option bar splits evenly
// instead of hugging its labels at the left. `overflow-x-auto` stays: a wider
// set of labels (the settings bar has four) still scrolls rather than squashing.
//
// Alignment is `start` below `sm` and `center` above it. Centring an
// overflowing scroll container pushes content off *both* ends: four settings
// labels are 566px in a 312px box, so the first tab sat at x = -117px and could
// not be scrolled to.
//
// A tab count is deliberately not rendered. Every surface carrying one already
// states that figure in a `Stat` directly beneath the strip, so a badge is a
// second rendering of a number the reader already has. The owner of a count
// that has no `Stat` is a `Stat`, not the tab label.
//
// `no-scrollbar` because the strip scrolls but must not paint: the pencil-grey
// 5px track/thumb is a permanent grey band under the labels on the one control
// users tap most. `scroll-snap` plus a clipped trailing tab is the cue instead.
const tabListBase =
  'flex items-center justify-start gap-1 overflow-x-auto overscroll-contain no-scrollbar scroll-px-3 ' +
  '[scroll-snap-type:x_proximity] sm:justify-center sm:scroll-px-0';

export const Tabs: React.FC<TabsProps> = ({
  items,
  active,
  onChange,
  variant = 'pill',
  className,
  ariaLabel = 'Navigasi tab',
}) => {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        tabListBase,
        variant === 'pill' ? 'rounded-chip bg-paper-raised p-1' : 'border-b border-rule',
        className
      )}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex-1 shrink-0 snap-start whitespace-nowrap text-center text-xs font-semibold transition-colors duration-120 ease-out-expo',
              focusRing,
              variant === 'pill'
                ? cn('rounded px-3 py-1.5 min-h-[44px]', selected ? 'bg-pen-500 text-paper' : 'text-ink-2 hover:text-ink')
                : cn(
                    'min-h-[44px] border-b-2 px-3 py-2 -mb-px',
                    selected
                      ? 'border-pen-500 text-ink-2'
                      : 'border-transparent text-ink-2 hover:text-ink'
                  )
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
