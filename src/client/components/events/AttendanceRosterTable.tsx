import React from 'react';
import {
  Users,
  LogIn,
  LogOut,
  Coffee,
  History,
  Building2,
  Table as TableIcon,
  LayoutGrid,
  Trash2,
} from 'lucide-react';
import { Attendance, SessionType } from '@/shared/types';
import { Badge } from '../ui/Badge';
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
  isManager,
}) => {
  const bulkActions: BulkActionItem[] = [
    {
      label: 'Hapus Terpilih',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      variant: 'danger',
      onClick: onDeleteAttendanceBatch,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Attendance Metrics Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Check-In Masuk</span>
            <span className="text-xl font-bold font-heading text-emerald-400">{sessionCounts.checkin}</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Check-Out Keluar</span>
            <span className="text-xl font-bold font-heading text-sky-400">{sessionCounts.checkout}</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Break Keluar</span>
            <span className="text-xl font-bold font-heading text-purple-300">{sessionCounts.breakOut}</span>
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Break Masuk</span>
            <span className="text-xl font-bold font-heading text-purple-400">{sessionCounts.breakIn}</span>
          </div>
        </div>
      </div>

      {/* Filter and Session Controls */}
      <div className="p-3.5 sm:p-4 rounded-2xl glass-panel border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        {/* Session Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          <button
            onClick={() => onSelectSessionFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              sessionFilter === 'ALL'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua ({attendances.length})
          </button>
          <button
            onClick={() => onSelectSessionFilter('CHECKIN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              sessionFilter === 'CHECKIN'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            Check-In ({sessionCounts.checkin})
          </button>
          <button
            onClick={() => onSelectSessionFilter('CHECKOUT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              sessionFilter === 'CHECKOUT'
                ? 'bg-sky-950/80 text-sky-400 border border-sky-800'
                : 'text-slate-400 hover:text-sky-400'
            }`}
          >
            Check-Out ({sessionCounts.checkout})
          </button>
          <button
            onClick={() => onSelectSessionFilter('BREAK_OUT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              sessionFilter === 'BREAK_OUT'
                ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                : 'text-slate-400 hover:text-purple-300'
            }`}
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
            className="w-full sm:w-44 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:border-sky-500"
          />

          {divisions.length > 0 && (
            <select
              id="roster-division"
              aria-label="Filter peserta berdasarkan divisi"
              onChange={(e) => onDivisionChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:border-sky-500"
            >
              <option value="">Semua Divisi</option>
              {divisions.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          )}

          <div className="md:hidden flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => onToggleMobileViewMode('card')}
              className={`p-1.5 rounded-lg ${mobileViewMode === 'card' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}
              title="Tampilan Kartu"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onToggleMobileViewMode('table')}
              className={`p-1.5 rounded-lg ${mobileViewMode === 'table' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}
              title="Tampilan Tabel"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

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
          icon={<Users className="w-8 h-8 text-sky-400" />}
          title="Belum Ada Presensi Tercatat"
          description={
            search || selectedDivision || sessionFilter !== 'ALL'
              ? 'Tidak ada data presensi yang sesuai dengan filter pencarian.'
              : 'Belum ada anggota yang melakukan scan QR presensi untuk kegiatan ini.'
          }
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className={`glass-panel rounded-2xl border border-slate-800/80 overflow-hidden ${mobileViewMode === 'card' ? 'hidden md:block' : 'block'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    {isManager && (
                      <th className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedAttendanceIds.size === displayedAttendances.length && displayedAttendances.length > 0}
                          onChange={onSelectAllAttendances}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                          aria-label="Pilih semua presensi"
                        />
                      </th>
                    )}
                    <th className="px-5 py-3.5">ID Anggota</th>
                    <th className="px-5 py-3.5">Nama Lengkap</th>
                    <th className="px-5 py-3.5">Divisi / Gugus</th>
                    <th className="px-5 py-3.5">Sesi Absensi</th>
                    <th className="px-5 py-3.5">Waktu Scan</th>
                    <th className="px-5 py-3.5">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedAttendances.map((att) => {
                    const isSelected = selectedAttendanceIds.has(att.id);
                    const sessionVariant =
                      att.session_type === 'CHECKIN'
                        ? 'emerald'
                        : att.session_type === 'CHECKOUT'
                        ? 'sky'
                        : att.session_type === 'BREAK_OUT'
                        ? 'purple'
                        : 'slate';

                    return (
                      <tr
                        key={att.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-sky-950/20 hover:bg-sky-950/30' : 'hover:bg-slate-900/40'
                        }`}
                      >
                        {isManager && (
                          <td className="w-10 px-4 py-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelectAttendance(att.id)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                              aria-label={`Pilih ${att.member_name}`}
                            />
                          </td>
                        )}
                        <td className="px-5 py-3.5 font-bold text-sky-400 font-oxanium">{att.member_external_id}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">{att.member_name}</td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {att.member_division || '-'} {att.member_group ? `(${att.member_group})` : ''}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={sessionVariant}>{att.session_type}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                          {att.scanned_at ? new Date(att.scanned_at).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-5 py-3.5">
                          {att.is_manual ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-800/40">
                              Manual
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-800/40">
                              QR Scan
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Grid View */}
          {mobileViewMode === 'card' && (
            <div className="md:hidden grid grid-cols-1 gap-2.5">
              {displayedAttendances.map((att) => {
                const isSelected = selectedAttendanceIds.has(att.id);
                return (
                  <div
                    key={att.id}
                    onClick={() => isManager && onToggleSelectAttendance(att.id)}
                    className={`p-3.5 rounded-2xl glass-panel border transition-colors ${
                      isSelected
                        ? 'border-sky-500 bg-sky-950/30'
                        : 'border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isManager && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelectAttendance(att.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                          />
                        )}
                        <div>
                          <h4 className="font-bold text-sm text-white">{att.member_name}</h4>
                          <span className="font-mono text-xs text-sky-400 font-oxanium">{att.member_external_id}</span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          att.session_type === 'CHECKIN'
                            ? 'emerald'
                            : att.session_type === 'CHECKOUT'
                            ? 'sky'
                            : att.session_type === 'BREAK_OUT'
                            ? 'purple'
                            : 'slate'
                        }
                      >
                        {att.session_type}
                      </Badge>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        {att.member_division || 'Umum'}
                      </span>
                      <span className="font-mono">
                        {att.scanned_at ? new Date(att.scanned_at).toLocaleTimeString('id-ID') : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
