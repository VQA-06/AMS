import React from 'react';
import { cn } from '../../lib/cn';

export interface TabItem {
  id: string;
  label: string;
  badge?: number;
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
        'flex items-center gap-1 overflow-x-auto no-scrollbar',
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
              'shrink-0 whitespace-nowrap text-xs font-semibold transition-colors duration-120 ease-out-expo',
              focusRing,
              variant === 'pill'
                ? cn('rounded px-3 py-1.5', selected ? 'bg-pen-500 text-paper' : 'text-ink-2 hover:text-ink')
                : cn(
                    'border-b-2 px-3 py-2 -mb-px',
                    selected
                      ? 'border-pen-500 text-ink-2'
                      : 'border-transparent text-ink-2 hover:text-ink'
                  )
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={cn(
                  'ml-1.5 font-oxanium text-[10px] font-bold tabular-nums',
                  variant === 'pill' && selected ? 'text-paper' : 'text-ink-2'
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
