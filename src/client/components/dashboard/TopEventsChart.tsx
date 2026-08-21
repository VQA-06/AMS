import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Calendar,
  Filter,
  Users,
  UserCheck,
  Building2,
  TrendingUp,
  MapPin,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
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
}

const PALETTE = [
  { fill: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', name: 'Sky' },
  { fill: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', name: 'Emerald' },
  { fill: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', name: 'Amber' },
  { fill: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', name: 'Purple' },
  { fill: '#fb7185', glow: 'rgba(251, 113, 133, 0.4)', name: 'Rose' },
  { fill: '#818cf8', glow: 'rgba(129, 140, 248, 0.4)', name: 'Indigo' },
  { fill: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.4)', name: 'Teal' },
  { fill: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', name: 'Orange' },
  { fill: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', name: 'Cyan' },
  { fill: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', name: 'Pink' },
];

export const TopEventsChart: React.FC<TopEventsChartProps> = ({
  events,
  loading = false,
  onSelectEvent,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'all' | 'year' | '30days'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [sortBy, setSortBy] = useState<'attendance' | 'recent'>('attendance');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  // Compute Pie Slices using Trigonometry
  const pieSlices = useMemo(() => {
    if (filteredEvents.length === 0) return [];

    const center = 100;
    const defaultR = 76;
    const defaultRIn = 48;
    const hoverR = 82;
    const hoverRIn = 44;

    const countSum = totalAttendees > 0 ? totalAttendees : filteredEvents.length;
    let accumulatedAngle = -90; // Start at 12 o'clock

    return filteredEvents.map((ev, index) => {
      const value = totalAttendees > 0 ? (ev.attendance_count || 0) : 1;
      const angleSweep = (value / countSum) * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angleSweep;
      accumulatedAngle += angleSweep;

      const isHovered = hoveredIndex === index;
      const r = isHovered ? hoverR : defaultR;
      const rIn = isHovered ? hoverRIn : defaultRIn;

      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const x1 = center + r * Math.cos(toRad(startAngle));
      const y1 = center + r * Math.sin(toRad(startAngle));
      const x2 = center + r * Math.cos(toRad(endAngle - 0.01));
      const y2 = center + r * Math.sin(toRad(endAngle - 0.01));

      const x1In = center + rIn * Math.cos(toRad(endAngle - 0.01));
      const y1In = center + rIn * Math.sin(toRad(endAngle - 0.01));
      const x2In = center + rIn * Math.cos(toRad(startAngle));
      const y2In = center + rIn * Math.sin(toRad(startAngle));

      const largeArc = angleSweep > 180 ? 1 : 0;
      const color = PALETTE[index % PALETTE.length];
      const percent = totalAttendees > 0 ? Math.round(((ev.attendance_count || 0) / totalAttendees) * 100) : 0;

      // SVG path definition
      const pathData =
        filteredEvents.length === 1 || angleSweep >= 359.9
          ? `M ${center} ${center - r} A ${r} ${r} 0 1 1 ${center - 0.01} ${center - r} L ${center - 0.01} ${center - rIn} A ${rIn} ${rIn} 0 1 0 ${center} ${center - rIn} Z`
          : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x1In} ${y1In} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x2In} ${y2In} Z`;

      return {
        pathData,
        color,
        event: ev,
        percent,
        isHovered,
      };
    });
  }, [filteredEvents, totalAttendees, hoveredIndex]);

  const activeHoveredItem = hoveredIndex !== null && filteredEvents[hoveredIndex] ? filteredEvents[hoveredIndex] : null;

  return (
    <div className="glass-panel-elevated rounded-3xl p-5 sm:p-6 border border-slate-800 space-y-5 shadow-2xl relative">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3.5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-lg shadow-sky-500/10">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-lg sm:text-xl text-white tracking-tight flex items-center gap-2">
              <span>Kegiatan Terbanyak Peserta</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Top 10
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Visualisasi grafik interaktif sebaran peserta tiap kegiatan
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* Period Filter */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                periodFilter === 'all'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setPeriodFilter('year')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                periodFilter === 'year'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tahun Ini
            </button>
            <button
              onClick={() => setPeriodFilter('30days')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                periodFilter === '30days'
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
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif Saja</option>
            <option value="closed">Selesai Saja</option>
          </select>

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="attendance">Peserta Terbanyak</option>
            <option value="recent">Kegiatan Terbaru</option>
          </select>
        </div>
      </div>

      {/* Main Graphical Display (Pie / Donut Chart + Top 10 Ranking List with Inner Scroll) */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs font-semibold animate-pulse">
          Memuat visualisasi kegiatan...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs space-y-1">
          <p className="font-semibold text-slate-400">Tidak ada kegiatan yang sesuai filter</p>
          <p className="text-[11px]">Coba ubah filter periode atau status kegiatan di atas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left: Interactive SVG Donut Chart (5 Cols) */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative py-2">
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-full h-full transform transition-all duration-300">
                {/* Slices */}
                {pieSlices.map((slice, idx) => (
                  <path
                    key={slice.event.id}
                    d={slice.pathData}
                    fill={slice.color.fill}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => onSelectEvent?.(slice.event.id)}
                    className="cursor-pointer transition-all duration-200 stroke-slate-950 hover:opacity-100"
                    strokeWidth="2.5"
                    style={{
                      opacity: hoveredIndex === null || hoveredIndex === idx ? 1 : 0.45,
                      filter: slice.isHovered ? `drop-shadow(0 0 8px ${slice.color.fill})` : 'none',
                    }}
                  />
                ))}
              </svg>

              {/* Dynamic Donut Center Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4 select-none">
                {activeHoveredItem ? (
                  <div className="space-y-0.5 animate-in zoom-in-95 duration-150 max-w-[130px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block truncate">
                      {activeHoveredItem.name}
                    </span>
                    <span className="text-2xl sm:text-3xl font-heading font-black text-white block leading-none">
                      {activeHoveredItem.attendance_count || 0}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {totalAttendees > 0
                        ? `${Math.round(((activeHoveredItem.attendance_count || 0) / totalAttendees) * 100)}% dari Total`
                        : '0%'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-0.5 animate-in fade-in max-w-[130px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Total Hadir
                    </span>
                    <span className="text-2xl sm:text-3xl font-heading font-black text-white block leading-none">
                      {totalAttendees}
                    </span>
                    <span className="text-[10px] text-sky-400 font-mono font-semibold block truncate">
                      {filteredEvents[0]?.name || 'Peserta'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-1 text-center">
              Arahkan kursor / sentuh slice untuk detail
            </p>
          </div>

          {/* Right: Rich Interactive Legend Cards (7 Cols) with Inner Scroll */}
          <div className="md:col-span-7 space-y-2 max-h-72 sm:max-h-80 overflow-y-auto pr-1.5 no-scrollbar">
            {filteredEvents.map((ev, idx) => {
              const color = PALETTE[idx % PALETTE.length];
              const isHovered = hoveredIndex === idx;
              const percent = totalAttendees > 0 ? Math.round(((ev.attendance_count || 0) / totalAttendees) * 100) : 0;

              return (
                <div
                  key={ev.id}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => onSelectEvent?.(ev.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isHovered
                      ? 'bg-slate-800/90 border-sky-500 shadow-lg shadow-sky-950/40 translate-x-1'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                  title="Klik untuk membuka detail absensi kegiatan"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Color Dot & Rank Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: color.fill, boxShadow: `0 0 6px ${color.fill}` }}
                      />
                      <span className="font-mono font-bold text-xs text-slate-400 w-4 text-center">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-sm text-white group-hover:text-sky-400 transition-colors truncate">
                          {ev.name}
                        </span>
                        {ev.status === 'active' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-400 shrink-0">
                            Selesai
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                        <span className="text-sky-400 font-semibold">{ev.member_count || 0} Anggota</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{ev.guest_count || 0} Tamu</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Count & Percentage Badge */}
                  <div className="text-right shrink-0 flex items-center gap-2.5">
                    <div>
                      <div className="font-heading font-black text-base text-white">
                        {ev.attendance_count || 0}{' '}
                        <span className="text-[10px] text-slate-400 font-normal uppercase">Hadir</span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-slate-400">{percent}%</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50"></span>
            <span>Anggota Resmi</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
            <span>Tamu Undangan</span>
          </span>
        </div>

        <div className="text-slate-400 text-[11px]">
          Total Keseluruhan:{' '}
          <strong className="text-white font-mono font-bold">{totalAttendees} Presensi Terdata</strong>
        </div>
      </div>
    </div>
  );
};
