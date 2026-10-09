import React from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';
import { Coffee } from '@phosphor-icons/react/Coffee';
import { SignIn } from '@phosphor-icons/react/SignIn';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { Trash } from '@phosphor-icons/react/Trash';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Users } from '@phosphor-icons/react/Users';
import { Attendance, SessionType } from '@/shared/types';
import { Button } from '../ui/Button';
import { sessionTypeMark } from '../../lib/event-status';
import { Stat } from '../ui/Stat';
import { cn } from '../../lib/cn';
import { EmptyState } from '../ui/EmptyState';
import { BulkActionBar, BulkActionItem } from '../ui/BulkActionBar';
import { RowList, type RowListItem } from '../ui/RowList';

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

  const rosterItems: RowListItem[] = displayedAttendances.map((att) => {
    const division = att.member_division
      ? `${att.member_division}${att.member_group ? ` (${att.member_group})` : ''}`
      : null;
    const scanned = att.scanned_at
      ? new Date(att.scanned_at).toLocaleTimeString('id-ID')
      : null;
    const meta = [
      att.member_external_id,
      division,
      scanned,
      att.is_manual ? 'Manual' : 'QR Scan',
    ]
      .filter(Boolean)
      .join('  ·  ');

    return {
      id: att.id,
      title: att.member_name || att.member_external_id || att.id,
      meta: meta || undefined,
      // The session type is the row's state word, and its mark tone is the only
      // place the session hue appears — `TRow` carried it the same way.
      status: {
        label: att.session_type,
        tone: sessionTypeMark(att.session_type),
      },
    };
  });

  return (
    <div className="space-y-4">
      {/* KPI Attendance Metrics Card */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <Stat
          label="Check-In Masuk"
          value={sessionCounts.checkin}
          // mark="seal"
          icon={<SignIn size={20} />}
        />
        <Stat
          label="Check-Out Keluar"
          value={sessionCounts.checkout}
          // mark="pen"
          icon={<SignOut size={20} />}
        />
        <Stat
          label="Break Keluar"
          value={sessionCounts.breakOut}
          // mark="idle"
          icon={<Coffee size={20} />}
        />
        <Stat
          label="Break Masuk"
          value={sessionCounts.breakIn}
          // mark="idle"
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
              'whitespace-nowrap rounded-chip px-3 py-1.5 min-h-[44px] text-xs font-bold transition-colors duration-120',
              sessionFilter === 'ALL'
                ? 'border border-pen-200/70 bg-pen-50/70 text-ink-2'
              : 'text-ink-2 hover:text-ink'
          )}
          >
            Semua
          </button>
          <button
            onClick={() => onSelectSessionFilter('CHECKIN')}
            className={cn(
              'whitespace-nowrap rounded-chip px-3 py-1.5 min-h-[44px] text-xs font-bold transition-colors duration-120',
              sessionFilter === 'CHECKIN'
                ? 'bg-seal-50 text-seal-600 border border-seal-200'
              : 'text-ink-2 hover:text-seal-600'
          )}
          >
            Check-In
          </button>
          <button
            onClick={() => onSelectSessionFilter('CHECKOUT')}
            className={cn(
              'whitespace-nowrap rounded-chip px-3 py-1.5 min-h-[44px] text-xs font-bold transition-colors duration-120',
              sessionFilter === 'CHECKOUT'
                ? 'border border-pen-200/70 bg-pen-50/70 text-ink-2'
              : 'text-ink-2 hover:text-ink'
          )}
          >
            Check-Out
          </button>
          <button
            onClick={() => onSelectSessionFilter('BREAK_OUT')}
            className={cn(
              'whitespace-nowrap rounded-chip px-3 py-1.5 min-h-[44px] text-xs font-bold transition-colors duration-120',
              sessionFilter === 'BREAK_OUT'
                ? 'bg-paper-sunk text-ink-3 border border-rule-strong'
              : 'text-ink-2 hover:text-ink-3'
          )}
          >
            Break
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

      {/* One grammar at every width: the roster is a record list, not a set of
          columns compared in parallel, so it was never a table. */}
      <RowList
        items={rosterItems}
        selectable={isManager}
        selectedIds={selectedAttendanceIds}
        onToggle={onToggleSelectAttendance}
        onToggleAll={onSelectAllAttendances}
        itemLabel="presensi"
        emptyState={
          <EmptyState
            icon={<Users size={32} className="text-ink-2" />}
            title="Belum Ada Presensi Tercatat"
            description={
              search || selectedDivision || sessionFilter !== 'ALL'
                ? 'Tidak ada data presensi yang sesuai dengan filter pencarian.'
                : 'Belum ada anggota yang melakukan scan QR presensi untuk kegiatan ini.'
            }
          />
        }
      />
    </div>
  );
};
