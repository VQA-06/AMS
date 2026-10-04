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
  totalCount?: number;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  actions: BulkActionItem[];
  itemLabel?: string;
}

const actionClass = (variant?: string, disabled?: boolean) =>
  cn(
    'shrink-0 select-none whitespace-nowrap rounded-chip px-3 py-1.5 text-xs font-bold',
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
 * Selection counter plus its actions. All presentation now lives in
 * `SelectionBar`; this only decides which buttons a page offers.
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  isAllSelected = false,
  actions,
  itemLabel = 'Item',
}) => {
  return (
    <SelectionBar
      count={selectedCount}
      totalCount={totalCount}
      onClear={onClearSelection}
      onToggleAll={onSelectAll}
      isAllSelected={isAllSelected}
      itemLabel={itemLabel}
    >
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