import React from 'react';
import { CaretLeft } from '@phosphor-icons/react/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { cn } from '../../lib/cn';

export interface PaginationProps {
  /** 1-based active page. */
  currentPage: number;
  /** Total number of records across all pages. */
  totalItems: number;
  /** Number of records per page. Defaults to 25. */
  pageSize?: number;
  /** Callback when user selects another page. */
  onPageChange: (page: number) => void;
  /** Noun for records in summary text, e.g. "baris", "anggota", "presensi", "log". Defaults to "baris". */
  itemLabel?: string;
  /** Optional container class name. */
  className?: string;
  /** Whether to hide controls when totalItems <= pageSize. Defaults to true. */
  hideOnSinglePage?: boolean;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

function getPageNumbers(currentPage: number, totalPages: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis-start', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis-start', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-end', totalPages];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 25,
  onPageChange,
  itemLabel = 'baris',
  className,
  hideOnSinglePage = true,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (hideOnSinglePage && totalItems <= pageSize) {
    return null;
  }

  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(totalItems, safeCurrentPage * pageSize);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);
  const buttonBase =
    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-chip border text-xs font-oxanium tabular-nums transition-colors duration-120 ease-out-expo disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav
      aria-label="Navigasi halaman"
      className={cn('flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-rule px-4 py-3', className)}
    >
      <span className="text-xs text-ink-2">
        Menampilkan <strong className="font-oxanium tabular-nums font-semibold text-ink">{`${startIndex}–${endIndex}`}</strong> dari{' '}
        <strong className="font-oxanium tabular-nums font-semibold text-ink">{totalItems}</strong> {itemLabel}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          aria-label="Halaman sebelumnya"
          className={cn(
            buttonBase,
            focusRing,
            'border-rule bg-paper-raised text-ink-2 hover:bg-paper-sunk hover:text-ink disabled:hover:bg-paper-raised disabled:hover:text-ink-2'
          )}
        >
          <CaretLeft className="h-4 w-4" />
        </button>

        {pageNumbers.map((p, idx) => {
          if (typeof p === 'string') {
            return (
              <span
                key={`${p}-${idx}`}
                aria-hidden="true"
                className="flex min-h-[44px] min-w-[28px] items-center justify-center text-xs text-ink-3"
              >
                …
              </span>
            );
          }

          const isActive = p === safeCurrentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Halaman ${p}`}
              className={cn(
                buttonBase,
                focusRing,
                isActive
                  ? 'border-pen-500 bg-pen-500 font-bold text-paper'
                  : 'border-rule bg-paper-raised text-ink-2 hover:bg-paper-sunk hover:text-ink'
              )}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          aria-label="Halaman berikutnya"
          className={cn(
            buttonBase,
            focusRing,
            'border-rule bg-paper-raised text-ink-2 hover:bg-paper-sunk hover:text-ink disabled:hover:bg-paper-raised disabled:hover:text-ink-2'
          )}
        >
          <CaretRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
};
