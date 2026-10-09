import React, { useState, useEffect } from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';
import { AuditLog } from '@/shared/types';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, THead, TBody, TRow, TCell } from '../../components/ui/Table';
import { Skeleton } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';

interface AuditTabProps {
  logs: AuditLog[];
  /**
   * The fetch has not settled yet. Without it an empty `logs` array is read as
   * "no activity ever", which is a claim about the data the page has not made
   * yet. Skeletons say "not yet" without claiming either way.
   */
  loading?: boolean;
}

/**
 * The audit trail stays a table on purpose, unlike the other settings tabs. It
 * is scanned by timestamp and actor rather than browsed as a list of things,
 * and four aligned columns are what make an audit log trustworthy at a glance.
 * There is no per-row action that could collapse into a RowList.
 *
 * `Table` owns the `overflow-x-auto`, so nothing here may set a min width or an
 * `overflow-hidden` on the frame: a min width on the *scroller* makes the
 * scroller wider than its parent, and the parent's `overflow-hidden` then clips
 * 500px of the audit log with no way to reach it. Four columns on a 344px
 * viewport genuinely need more room than they have, which is what the scroller
 * is for.
 */
export const AuditTab: React.FC<AuditTabProps> = ({ logs, loading }) => {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const activePage = Math.max(1, Math.min(page, totalPages));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite" aria-label="Memuat log audit">
        <Skeleton className="h-4 w-40" />
        <div className="surface space-y-3 rounded-panel p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-28 shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      // The empty state's tile icon marks "no records yet" — the one status this
      // surface needs that the surrounding copy does not already say.
      <EmptyState
        icon={<ClockCounterClockwise className="h-8 w-8 text-ink-2" />}
        headingLevel={2}
        title="Belum ada aktivitas tercatat"
        description="Setiap perubahan pada data anggota dan kegiatan akan tercatat di sini lengkap dengan waktu dan pelaku aksinya."
      />
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-sm font-bold text-ink">Riwayat Aktivitas</h2>
      <Card>
        <Table>
          <THead>
            <tr>
              <TCell header>Waktu</TCell>
              <TCell header>Aksi</TCell>
              <TCell header>Pelaksana</TCell>
              <TCell header>Detail</TCell>
            </tr>
          </THead>
          <TBody>
            {logs.slice((activePage - 1) * pageSize, activePage * pageSize).map((log) => (
              <TRow key={log.id}>
                <TCell className="whitespace-nowrap font-oxanium text-ink-2">
                  {new Date(log.created_at).toLocaleString('id-ID')}
                </TCell>
                <TCell truncate className="font-semibold text-ink-2">
                  {log.action}
                </TCell>
                <TCell truncate className="text-ink">
                  {log.admin_name || log.admin_email || 'Sistem / Dev'}
                </TCell>
                <TCell truncate className="font-oxanium text-ink-2">
                  {typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta)}
                </TCell>
              </TRow>
            ))}
          </TBody>
        </Table>
        <Pagination
          currentPage={activePage}
          totalItems={logs.length}
          pageSize={pageSize}
          onPageChange={setPage}
          itemLabel="log"
        />
      </Card>
    </div>
  );
};