import React from 'react';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';
import { Coffee } from '@phosphor-icons/react/Coffee';
import { SignIn } from '@phosphor-icons/react/SignIn';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { SquaresFour } from '@phosphor-icons/react/SquaresFour';
import { Table as TableIcon } from '@phosphor-icons/react/Table';
import { Trash } from '@phosphor-icons/react/Trash';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Users } from '@phosphor-icons/react/Users';
import { Attendance, SessionType } from '@/shared/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { sessionTypeMark } from '../../lib/event-status';
import { Stat } from '../ui/Stat';
import { Table, THead, TBody, TRow, TCell } from '../ui/Table';
import { cn } from '../../lib/cn';
import { EmptyState } from '../ui/EmptyState';
import { BulkActionBar, BulkActionItem } from '../ui/BulkActionBar';

export interface AttendanceRosterTableProps {
  attendances: Attendance[];
  displayedAttendances: Attendance[];
  totalScanned: number;
  sessionCounts: {
    checkin: number;
    checkout: number;
    breakOut: number;
    breakIn: number;
  };
  sessionFilter: 'ALL' | SessionType;
  onSelectSessionFilter: (filter: 'ALL' | SessionType) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedDivision: string;
  onDivisionChange: (division: string) => void;
  divisions: string[];
  mobileViewMode: 'card' | 'table';
  onToggleMobileViewMode: (mode: 'card' | 'table') => void;
  selectedAttendanceIds: Set<string>;
  onToggleSelectAttendance: (id: string) => void;
  onSelectAllAttendances: () => void;
  onDeleteAttendanceBatch: () => void;
  onClearSelection?: () => void;
  /** Opens the manual-attendance form; gated by `isManager` at the call site. */
  onOpenManualAttendance: () => void;
  isManager: boolean;
}

export const AttendanceRosterTable: React.FC<AttendanceRosterTableProps> = ({
  attendances,
  displayedAttendances,
  totalScanned,
  sessionCounts,
  sessionFilter,
  onSelectSessionFilter,
  search,
  onSearchChange,
  selectedDivision,
  onDivisionChange,
  divisions,
  mobileViewMode,
  onToggleMobileViewMode,
  selectedAttendanceIds,
  onToggleSelectAttendance,
  onSelectAllAttendances,
  onDeleteAttendanceBatch,
  onClearSelection,
  onOpenManualAttendance,
  isManager,
}) => {
  const bulkActions: BulkActionItem[] = [
    {
      label: 'Hapus Terpilih',
      icon: <Trash className="w-3.5 h-3.5" />,
      variant: 'danger',
      onClick: onDeleteAttendanceBatch,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Attendance Metrics Card */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <Stat
          label="Check-In Masuk"
          value={sessionCounts.checkin}
          mark="seal"
          icon={<SignIn size={20} />}
        />
        <Stat
          label="Check-Out Keluar"
          value={sessionCounts.checkout}
          mark="pen"
          icon={<SignOut size={20} />}
        />
        <Stat
          label="Break Keluar"
          value={sessionCounts.breakOut}
          mark="idle"
          icon={<Coffee size={20} />}
        />
        <Stat
          label="Break Masuk"
          value={sessionCounts.breakIn}
          mark="idle"
          icon={<ClockCounterClockwise size={20} />}
        />
      </div>

      {/* Filter and Session Controls */}
      <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-panel p-3.5 sm:p-4">
        {/* Session Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          <button
            onClick={() => onSelectSessionFilter('ALL')}
            className={cn(
              'whitespace-nowrap rounded-chip px-3 py-1.5 text-xs font-bold transition-colors duration-120',
              sessionFilter === 'ALL'
                ? 'border border-pen-200/70 bg-pen-50/70 text-ink-2'
              : 'text-ink-2 hover:text-ink'
          )}
          >
            Semua ({attendances.length})
          </button>
          <button
            onClick={() => onSelectSessionFilter('CHECKIN')}
            className={cn(
              'whitespace-nowrap rounded-chip px-3 py-1.5 text-xs font-bold transition-colors duration-120',
              sessionFilter === 'CHECKIN'
                ? 'bg-seal-50 text-seal-600 border border-seal-200'
              : 'text-ink-2 hover:text-seal-600'
          )}
          >
            Check-In ({sessionCounts.checkin})
          </button>
          <button
            onClick={() => onSelectSessionFilter('CHECKOUT')}
            className={cn(
              'whitespace-nowrap rounded-chip px-3 py-1.5 text-xs font-bold transition-colors duration-120',
              sessionFilter === 'CHECKOUT'
                ? 'border border-pen-200/70 bg-pen-50/70 text-ink-2'
              : 'text-ink-2 hover:text-ink'
          )}
          >
            Check-Out ({sessionCounts.checkout})
          </button>
          <button
            onClick={() => onSelectSessionFilter('BREAK_OUT')}
            className={cn(
              'whitespace-nowrap rounded-chip px-3 py-1.5 text-xs font-bold transition-colors duration-120',
              sessionFilter === 'BREAK_OUT'
                ? 'bg-paper-sunk text-ink-3 border border-rule-strong'
              : 'text-ink-2 hover:text-ink-3'
          )}
          >
            Break ({sessionCounts.breakOut})
          </button>
        </div>

        {/* Search & Division Selector & View Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            id="roster-search"
            aria-label="Cari peserta berdasarkan nama atau ID"
            placeholder="Cari nama / ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-chip border border-rule-strong bg-paper-raised px-3 py-1.5 text-xs text-ink transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:w-44"
          />

          {divisions.length > 0 && (
            <select
              id="roster-division"
              aria-label="Filter peserta berdasarkan divisi"
              onChange={(e) => onDivisionChange(e.target.value)}
              className="rounded-chip border border-rule-strong bg-paper-raised px-2.5 py-1.5 text-xs text-ink transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <option value="">Semua Divisi</option>
              {divisions.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 rounded-chip border border-rule bg-paper-raised p-1 md:hidden">
            <button
              type="button"
              onClick={() => onToggleMobileViewMode('card')}
              className={cn(
                'touch-target rounded-chip p-1.5 transition-colors',
                mobileViewMode === 'card'
                  ? 'bg-pen-500 text-paper'
                  : 'text-ink-2 hover:text-ink'
              )}
              aria-label="Tampilan Kartu"
            >
              <SquaresFour className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onToggleMobileViewMode('table')}
              className={cn(
                'touch-target rounded-chip p-1.5 transition-colors',
                mobileViewMode === 'table'
                  ? 'bg-pen-500 text-paper'
                  : 'text-ink-2 hover:text-ink'
              )}
              aria-label="Tampilan Tabel"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Manager actions: manual entry is an always-available escape hatch when
          the camera fails, so it stays visible rather than hiding in the bar. */}
      {isManager && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenManualAttendance}
            icon={<UserPlus size={14} />}
          >
            Catat Hadir Manual
          </Button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {isManager && (
        <BulkActionBar
          selectedCount={selectedAttendanceIds.size}
          actions={bulkActions}
          onClearSelection={onClearSelection || onSelectAllAttendances}
        />
      )}

      {/* Content: Empty State vs Table vs Cards */}
      {displayedAttendances.length === 0 ? (
        <EmptyState
          icon={<Users size={32} className="text-ink-2" />}
          title="Belum Ada Presensi Tercatat"
          description={
            search || selectedDivision || sessionFilter !== 'ALL'
              ? 'Tidak ada data presensi yang sesuai dengan filter pencarian.'
              : 'Belum ada anggota yang melakukan scan QR presensi untuk kegiatan ini.'
          }
        />
      ) : (
        <>
          {/* Desktop Table View — the rail on each row encodes the session type,
              which is why it varies per row and is not decoration. */}
          <Table
            className={
              mobileViewMode === 'card' ? 'hidden md:block' : 'block'
            }
          >
            <THead>
              <tr>
                {isManager && (
                  <TCell header className="w-10 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedAttendanceIds.size === displayedAttendances.length &&
                        displayedAttendances.length > 0
                      }
                      onChange={onSelectAllAttendances}
                      className="h-4 w-4 cursor-pointer rounded border-rule-strong bg-paper-raised accent-pen-500"
                      aria-label="Pilih semua presensi"
                    />
                  </TCell>
                )}
                <TCell header>ID Anggota</TCell>
                <TCell header>Nama Lengkap</TCell>
                <TCell header>Divisi / Gugus</TCell>
                <TCell header>Sesi Absensi</TCell>
                <TCell header>Waktu Scan</TCell>
                <TCell header>Metode</TCell>
              </tr>
            </THead>
            <TBody>
              {displayedAttendances.map((att) => {
                const isSelected = selectedAttendanceIds.has(att.id);

                return (
                  <TRow
                    key={att.id}
                    selected={isSelected}
                    mark={sessionTypeMark(att.session_type)}
                  >
                    {isManager && (
                      <TCell className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelectAttendance(att.id)}
                          className="h-4 w-4 cursor-pointer rounded border-rule-strong bg-paper-raised accent-pen-500"
                          aria-label={`Pilih ${att.member_name}`}
                        />
                      </TCell>
                    )}
                    <TCell className="font-oxanium font-bold text-ink-2">
                      {att.member_external_id}
                    </TCell>
                    <TCell className="font-semibold text-ink" truncate>
                      {att.member_name}
                    </TCell>
                    <TCell className="text-ink-2">
                      {att.member_division || '-'}{' '}
                      {att.member_group ? `(${att.member_group})` : ''}
                    </TCell>
                    <TCell className="font-oxanium text-xs font-bold text-ink">
                      {att.session_type}
                    </TCell>
                    <TCell className="font-oxanium text-[11px] text-ink-2">
                      {att.scanned_at
                        ? new Date(att.scanned_at).toLocaleString('id-ID')
                        : '-'}
                    </TCell>
                    <TCell>
                      {att.is_manual ? (
                        <Badge variant="pending" size="xs">
                          Manual
                        </Badge>
                      ) : (
                        <Badge variant="seal" size="xs">
                          QR Scan
                        </Badge>
                      )}
                    </TCell>
                  </TRow>
                );
              })}
            </TBody>
          </Table>

          {/* Mobile Card Grid View */}
          {mobileViewMode === 'card' && (
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
              {displayedAttendances.map((att) => {
                const isSelected = selectedAttendanceIds.has(att.id);
                return (
                  <Card
                    key={att.id}
                    mark={sessionTypeMark(att.session_type)}
                    className={cn(
                      'cursor-pointer p-3.5 transition-colors',
                      isSelected && 'bg-paper-sunk'
                    )}
                    onClick={() => isManager && onToggleSelectAttendance(att.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {isManager && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelectAttendance(att.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-rule-strong bg-paper-raised accent-pen-500"
                            aria-label={`Pilih ${att.member_name}`}
                          />
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-ink">
                            {att.member_name}
                          </h3>
                          <span className="font-oxanium text-xs text-ink-2">
                            {att.member_external_id}
                          </span>
                        </div>
                      </div>
                      <span className="font-oxanium shrink-0 text-[10px] font-bold text-ink-2">
                        {att.session_type}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-rule pt-2.5 text-[11px] text-ink-2">
                      <span className="flex min-w-0 items-center gap-1">
                        <Buildings size={12} className="shrink-0 text-ink-2" />
                        <span className="truncate">{att.member_division || 'Umum'}</span>
                      </span>
                      <span className="shrink-0 font-oxanium">
                        {att.scanned_at
                          ? new Date(att.scanned_at).toLocaleTimeString('id-ID')
                          : '-'}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
