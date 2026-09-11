import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Calendar,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { EventStatus, QrPolicy } from '@/shared/types';

export interface TopEventStatItem {
  id: string;
  name: string;
  status: EventStatus;
  starts_at: string | null;
  ends_at: string | null;
  qr_policy: QrPolicy;
  location_name: string | null;
  attendance_count: number;
  checkin_count: number;
  checkout_count: number;
  guest_count: number;
  member_count: number;
}

interface TopEventsChartProps {
  events: TopEventStatItem[];
  loading?: boolean;
  onSelectEvent?: (eventId: string) => void;
  onOpenScanner?: () => void;
}

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: any[];
  totalAttendees: number;
}

const CustomPieTooltip: React.FC<CustomPieTooltipProps> = ({ active, payload, totalAttendees }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload as (TopEventStatItem & { fill: string }) | undefined;
  if (!item) return null;

  const totalPct = totalAttendees > 0 ? Math.round((item.attendance_count / totalAttendees) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-700/90 bg-slate-900/98 p-3 text-xs shadow-2xl backdrop-blur-md max-w-[260px] space-y-2 pointer-events-none relative z-50">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
          <p className="font-bold text-white text-xs line-clamp-1">{item.name}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${item.status === 'active'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
            {item.status === 'active' ? 'Aktif' : 'Selesai'}
          </span>
          {item.location_name && (
            <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
              {item.location_name}
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-slate-800 pt-1.5 space-y-1 font-mono text-[11px]">
        <div className="flex items-center justify-between text-sky-400">
          <span>Total Presensi:</span>
          <span className="font-bold">{item.attendance_count} hadir</span>
        </div>
        <div className="flex items-center justify-between text-slate-400 text-[10px]">
          <span>Komposisi:</span>
          <span>{item.member_count || 0} Anggota • {item.guest_count || 0} Tamu</span>
        </div>
        <div className="flex items-center justify-between text-slate-400 text-[10px]">
          <span>Pangsa Kehadiran:</span>
          <span>{totalPct}% dari total</span>
        </div>
      </div>
    </div>
  );
};

const PIE_PALETTE = [
  '#0284c7', // Sky 600
  '#14b8a6', // Teal 500
  '#6366f1', // Indigo 500
  '#f59e0b', // Amber 500
  '#ec4899', // Pink 500
];

export const TopEventsChart: React.FC<TopEventsChartProps> = ({
  events,
  loading = false,
  onSelectEvent,
  onOpenScanner,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'all' | 'year' | '30days'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [sortBy, setSortBy] = useState<'attendance' | 'recent'>('attendance');

  const filteredEvents = useMemo(() => {
    let list = [...events];

    // Period filter
    const now = Date.now();
    if (periodFilter === '30days') {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      list = list.filter((ev) => {
        if (!ev.starts_at) return true;
        return now - new Date(ev.starts_at).getTime() <= thirtyDaysMs;
      });
    } else if (periodFilter === 'year') {
      const currentYear = new Date().getFullYear().toString();
      list = list.filter((ev) => {
        if (!ev.starts_at) return true;
        return ev.starts_at.startsWith(currentYear);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((ev) => ev.status === statusFilter);
    }

    // Sort
    if (sortBy === 'attendance') {
      list.sort((a, b) => (b.attendance_count || 0) - (a.attendance_count || 0));
    } else {
      list.sort((a, b) => {
        const timeA = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const timeB = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return timeB - timeA;
      });
    }

    return list.slice(0, 10); // Limited to Top 10
  }, [events, periodFilter, statusFilter, sortBy]);

  const totalAttendees = useMemo(() => {
    return filteredEvents.reduce((acc, ev) => acc + (ev.attendance_count || 0), 0);
  }, [filteredEvents]);

  // Donut data for Recharts PieChart
  const pieData = useMemo(() => {
    const validEvents = filteredEvents.filter((ev) => (ev.attendance_count || 0) > 0);
    if (validEvents.length === 0) return [];
    return validEvents.slice(0, 5).map((ev, idx) => ({
      ...ev,
      value: ev.attendance_count || 0,
      fill: PIE_PALETTE[idx % PIE_PALETTE.length],
    }));
  }, [filteredEvents]);

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-800 flex flex-col justify-between shadow-xl space-y-4 h-full min-w-0">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-sky-400" />
              <span>Sebaran Kehadiran Kegiatan</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Peringkat dan volume kehadiran presensi per agenda kegiatan
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* Period Filter */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setPeriodFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all min-h-[32px] sm:min-h-0 flex items-center ${periodFilter === 'all'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('year')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all min-h-[32px] sm:min-h-0 flex items-center ${periodFilter === 'year'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Tahun Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('30days')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all min-h-[32px] sm:min-h-0 flex items-center ${periodFilter === '30days'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              30 Hari
            </button>
          </div>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium focus:outline-none focus:border-sky-500 cursor-pointer min-h-[36px]"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif Saja</option>
            <option value="closed">Selesai Saja</option>
          </select>

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium focus:outline-none focus:border-sky-500 cursor-pointer min-h-[36px]"
          >
            <option value="attendance">Peserta Terbanyak</option>
            <option value="recent">Kegiatan Terbaru</option>
          </select>
        </div>
      </div>

      {/* Main Graphical Display: Pure Centered Recharts PieChart (No List, Clean Z-Index) */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs font-semibold animate-pulse">
            Memuat sebaran data kegiatan...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs space-y-1 w-full">
            <p className="font-semibold text-slate-400">Tidak ada kegiatan yang sesuai filter</p>
            <p className="text-[11px]">Coba ubah filter periode atau status kegiatan di atas.</p>
          </div>
        ) : totalAttendees === 0 ? (
          /* Actionable Zero-Attendance State */
          <div className="space-y-3 w-full">
            <div className="py-4 px-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <Calendar className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Belum Ada Presensi Tercatat</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {filteredEvents.length} kegiatan terdaftar siap menerima pemindaian absensi tiket QR.
                  </p>
                </div>
              </div>
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="min-h-[44px] sm:min-h-0 px-3.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <span>Buka Scanner QR</span>
                </button>
              )}
            </div>

            {/* Event Readiness List */}
            <div className="space-y-2">
              {filteredEvents.slice(0, 3).map((ev, idx) => (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent?.(ev.id)}
                  className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between gap-2 hover:bg-slate-900/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors truncate">
                        {ev.name}
                      </p>
                      {ev.location_name && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                          <span>{ev.location_name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ev.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                      {ev.status === 'active' ? 'Siap Scan' : 'Draft'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Pure Recharts Donut PieChart Hero (Centered, Spacious, Zero Overlap) */
          <div className="w-full flex flex-col items-center justify-center py-2 space-y-3">
            {/* Centered Donut with Proper Z-Index */}
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={<CustomPieTooltip totalAttendees={totalAttendees} />}
                    wrapperStyle={{ zIndex: 1000 }}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={56}
                    outerRadius={74}
                    stroke="#0d1527"
                    strokeWidth={3}
                    cornerRadius={6}
                    paddingAngle={pieData.length > 1 ? 4 : 0}
                    onClick={(entry: any) => {
                      if (entry?.id && onSelectEvent) {
                        onSelectEvent(entry.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Total Attendances Metric (Lower Z-Index, Unobtrusive) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center z-0">
                <span className="text-3xl sm:text-4xl font-extrabold font-heading text-white tracking-tight">
                  {totalAttendees}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mt-0.5">
                  Total Hadir
                </span>
              </div>
            </div>

            {/* Clean Minimalist Horizontal Legend Tags (No List, Pure Hero Chart) */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 max-w-md">
              {pieData.map((ev, idx) => {
                const totalPct = totalAttendees > 0 ? Math.round((ev.value / totalAttendees) * 100) : 0;

                return (
                  <button
                    type="button"
                    key={ev.id}
                    onClick={() => onSelectEvent?.(ev.id)}
                    className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-mono flex items-center gap-1.5 hover:border-slate-700 transition-colors cursor-pointer text-slate-200"
                    title={`${ev.name}: ${ev.value} hadir (${totalPct}%)`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ev.fill }}
                    />
                    <span className="font-semibold truncate max-w-[120px]">{ev.name}</span>
                    <span className="text-slate-400">({ev.value})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
        <span>Total Terdata: <strong className="text-white font-bold">{totalAttendees}</strong> Presensi</span>
        <span>{filteredEvents.length} Kegiatan Terdaftar</span>
      </div>
    </div>
  );
};
