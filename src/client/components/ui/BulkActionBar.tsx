import React from 'react';
import { Trash } from '@phosphor-icons/react/Trash';
import { cn } from '../../lib/cn';
import { SelectionBar } from './SelectionBar';

export interface BulkActionItem {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'warning' | 'default';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkActionItem[];
}

const actionClass = (variant?: string, disabled?: boolean) =>
  cn(
    'shrink-0 select-none whitespace-nowrap rounded-chip px-2.5 py-1.5 min-h-[44px] text-xs font-bold sm:px-3',
    'transition-colors duration-120 ease-out-expo',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
    'flex items-center gap-1.5',
    disabled && 'cursor-not-allowed border border-rule bg-paper-sunk text-ink-3',
    !disabled && variant === 'primary' && 'bg-ink text-paper hover:bg-ink-2',
    !disabled && variant === 'danger' && 'bg-pen-500 text-paper hover:bg-pen-600',
    !disabled && variant === 'warning' && 'bg-pending-500 text-paper hover:bg-pending-600',
    !disabled &&
      (!variant || variant === 'default') &&
      'border border-rule-strong bg-paper-raised text-ink hover:bg-paper-sunk'
  );

/**
 * Selection actions. All presentation now lives in `SelectionBar`; this only
 * decides which buttons a page offers.
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  actions,
}) => {
  return (
    <SelectionBar count={selectedCount} onClear={onClearSelection}>
      {actions.map((act, index) => (
        <button
          key={index}
          type="button"
          disabled={act.disabled || act.loading}
          onClick={act.onClick}
          className={actionClass(act.variant, act.disabled || act.loading)}
        >
          {act.icon ?? <Trash size={14} />}
          <span>{act.label}</span>
        </button>
      ))}
    </SelectionBar>
  );
};