import React from 'react';
import { CheckSquare, X, Square } from 'lucide-react';

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

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  isAllSelected = false,
  actions,
  itemLabel = 'Item',
}) => {
  if (selectedCount === 0) return null;

  const getButtonClass = (variant?: string, disabled?: boolean) => {
    const base =
      'px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap select-none';
    if (disabled) {
      return `${base} opacity-50 cursor-not-allowed bg-slate-800 text-slate-500`;
    }
    switch (variant) {
      case 'primary':
        return `${base} bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20 active:scale-95`;
      case 'danger':
        return `${base} bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 active:scale-95`;
      case 'warning':
        return `${base} bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95`;
      case 'default':
      default:
        return `${base} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95`;
    }
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-0 right-0 z-50 px-3 sm:px-6 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-4xl bg-slate-900/95 sm:bg-slate-900 backdrop-blur-xl border border-sky-500/40 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 shadow-2xl shadow-slate-950/90 ring-1 ring-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Left: Counter & Select All toggle */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-sky-500 text-slate-950 font-black font-heading text-xs shadow-md shadow-sky-500/30 shrink-0">
              {selectedCount}
            </span>
            <div className="text-left shrink-0">
              <span className="text-xs font-bold text-white block leading-tight whitespace-nowrap">
                {selectedCount} {itemLabel} Terpilih
              </span>
              {totalCount !== undefined && (
                <span className="text-[10px] text-slate-400 block whitespace-nowrap">
                  dari total {totalCount} {itemLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:hidden shrink-0">
            {onSelectAll && (
              <button
                type="button"
                onClick={onSelectAll}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 shrink-0"
                title={isAllSelected ? 'Batalkan Pilih Semua' : 'Pilih Semua'}
                aria-label={isAllSelected ? 'Batalkan Pilih Semua' : 'Pilih Semua'}
              >
                {isAllSelected ? <CheckSquare className="w-4 h-4 text-sky-400" /> : <Square className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClearSelection}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 shrink-0"
              title="Batal Memilih"
              aria-label="Batal Memilih"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Actions list */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto justify-start sm:justify-end pb-1 sm:pb-0 pr-2 sm:pr-0 scroll-smooth touch-pan-x overscroll-contain no-scrollbar">
          {onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 border border-slate-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 shrink-0 whitespace-nowrap select-none"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>Batal Pilih Semua</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Pilih Semua</span>
                </>
              )}
            </button>
          )}

          {actions.map((act, index) => (
            <button
              key={index}
              type="button"
              disabled={act.disabled || act.loading}
              onClick={act.onClick}
              className={getButtonClass(act.variant, act.disabled || act.loading)}
            >
              {act.icon && <span className="w-3.5 h-3.5">{act.icon}</span>}
              <span>{act.label}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={onClearSelection}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 bg-slate-800/40 border border-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 shrink-0 whitespace-nowrap select-none"
            title="Batal"
          >
            <X className="w-3.5 h-3.5" />
            <span>Batal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
