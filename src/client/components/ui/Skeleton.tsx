import React from 'react';
import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The one skeleton system. Every loading placeholder in the console uses this
 * single shimmer; pages must not add their own `animate-pulse` block.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => {
  return (
    <div className={cn('skeleton-shimmer rounded-chip', className)} style={style} aria-hidden="true" />
  );
};

/**
 * Skeleton loader for Member List (Matches exact mobile cards & desktop table layout)
 */
export const SkeletonMemberList: React.FC<{ rows?: number }> = ({ rows = 8 }) => {
  return (
    <div className="space-y-3">
      {/* Mobile Card Skeletons (< md screens) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 6) }).map((_, idx) => (
          <div
            key={`skel-m-card-${idx}`}
            className="surface-raised rounded-panel p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 w-full">
                <Skeleton className="w-4 h-4 rounded mt-1 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rule">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>

            <div className="flex items-center justify-end gap-1 pt-1">
              <Skeleton className="w-7 h-7 rounded-lg" />
              <Skeleton className="w-7 h-7 rounded-lg" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Skeletons (>= md screens) */}
      <div className="surface hidden overflow-hidden rounded-panel shadow-ambient md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink">
            <thead className="surface-raised text-ink-2 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <Skeleton className="w-4 h-4 rounded" />
                </th>
                <th className="px-4 py-3.5">ID Anggota</th>
                <th className="px-4 py-3.5">Nama & Kontak</th>
                <th className="px-4 py-3.5">Divisi</th>
                <th className="px-4 py-3.5">Grup / Tim</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-center">QR Pass</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {Array.from({ length: rows }).map((_, idx) => (
                <tr key={`skel-row-${idx}`}>
                  <td className="px-4 py-3.5">
                    <Skeleton className="w-4 h-4 rounded" />
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-4 py-3.5 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-5 w-24 rounded-lg" />
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-5 w-20 rounded-lg" />
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex justify-center">
                      <Skeleton className="h-7 w-20 rounded-xl" />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Skeleton className="w-7 h-7 rounded-lg" />
                      <Skeleton className="w-7 h-7 rounded-lg" />
                      <Skeleton className="w-7 h-7 rounded-lg" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for Events List
 */
export const SkeletonEventList: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`skel-event-${idx}`}
          className="surface space-y-4 rounded-panel p-5 shadow-ambient"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          </div>

          <div className="space-y-2 pt-2 border-t border-rule-strong/60">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-rule-strong/60">
            <Skeleton className="h-4 w-28" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton loader for Stat Cards
 */
export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`skel-stat-${idx}`}
          className="surface space-y-2 rounded-panel p-4 shadow-ambient"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="w-7 h-7 rounded-xl" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
};
