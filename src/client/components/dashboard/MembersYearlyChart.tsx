import React, { useState, useMemo } from 'react';
import {
  Users,
  TrendingUp,
  UserCheck,
  UserX,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';

export interface YearlyMemberStat {
  year: string;
  active_count: number;
  inactive_count: number;
  total_count: number;
}

interface MembersYearlyChartProps {
  stats: YearlyMemberStat[];
  totalActiveMembers: number;
  totalAllMembers: number;
  loading?: boolean;
}

export const MembersYearlyChart: React.FC<MembersYearlyChartProps> = ({
  stats,
  totalActiveMembers,
  totalAllMembers,
  loading = false,
}) => {
  // Default filter: 'active' as explicitly requested by user
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');
  const [hoveredYear, setHoveredYear] = useState<YearlyMemberStat | null>(null);

  // Compute stats if backend returned empty array or fallback
  const processedStats = useMemo(() => {
    if (stats.length > 0) return stats;

    const currentYear = new Date().getFullYear().toString();
    return [
      {
        year: currentYear,
        active_count: totalActiveMembers,
        inactive_count: Math.max(0, totalAllMembers - totalActiveMembers),
        total_count: totalAllMembers,
      },
    ];
  }, [stats, totalActiveMembers, totalAllMembers]);

  const maxVal = useMemo(() => {
    const values = processedStats.map((s) => {
      if (statusFilter === 'active') return s.active_count;
      if (statusFilter === 'inactive') return s.inactive_count;
      return s.total_count;
    });
    const max = Math.max(...values, 1);
    return max;
  }, [processedStats, statusFilter]);

  const totalFilteredCount = useMemo(() => {
    return processedStats.reduce((acc, s) => {
      if (statusFilter === 'active') return acc + s.active_count;
      if (statusFilter === 'inactive') return acc + s.inactive_count;
      return acc + s.total_count;
    }, 0);
  }, [processedStats, statusFilter]);

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800 flex flex-col justify-between relative overflow-hidden group shadow-xl">
      {/* Top Row: Metric & Filter Pills */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Stat Anggota per Tahun</span>
          </span>

          {/* Status Filter Toggle Pills (Default: Aktif) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px]">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Anggota Status Aktif (Default)"
            >
              Aktif
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Semua Anggota Terdaftar"
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Anggota Nonaktif"
            >
              Nonaktif
            </button>
          </div>
        </div>

        {/* Big Number Headline */}
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-2xl sm:text-3xl font-bold font-heading text-white">
            {loading ? '...' : totalFilteredCount}
          </p>
          <span className="text-xs font-semibold text-slate-400">
            {statusFilter === 'active'
              ? 'Anggota Aktif'
              : statusFilter === 'inactive'
              ? 'Anggota Nonaktif'
              : 'Total Terdaftar'}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{totalActiveMembers} aktif dari {totalAllMembers} anggota utama</span>
        </p>
      </div>

      {/* SVG Interactive Yearly Column Chart */}
      <div className="mt-4 pt-3 border-t border-slate-800/80">
        <div className="flex items-end justify-between gap-2 h-20 sm:h-24 w-full px-1">
          {processedStats.map((item) => {
            const count =
              statusFilter === 'active'
                ? item.active_count
                : statusFilter === 'inactive'
                ? item.inactive_count
                : item.total_count;

            const heightPct = Math.max(12, Math.round((count / maxVal) * 100));
            const isHovered = hoveredYear?.year === item.year;

            return (
              <div
                key={item.year}
                onMouseEnter={() => setHoveredYear(item)}
                onMouseLeave={() => setHoveredYear(null)}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group/bar cursor-pointer relative"
              >
                {/* Tooltip on Hover */}
                {isHovered && (
                  <div className="absolute -top-12 z-30 bg-slate-900/95 border border-sky-500/60 rounded-xl p-1.5 text-[10px] text-white shadow-xl shadow-slate-950/80 whitespace-nowrap animate-in zoom-in-95 pointer-events-none">
                    <div className="font-bold text-sky-400 font-mono">Tahun {item.year}</div>
                    <div>{count} {statusFilter} ({item.total_count} total)</div>
                  </div>
                )}

                {/* Number above bar */}
                <span
                  className={`text-[9px] font-mono font-bold transition-all ${
                    isHovered ? 'text-sky-300 scale-110' : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>

                {/* Animated Bar Column */}
                <div className="w-full max-w-[32px] bg-slate-900 rounded-t-lg overflow-hidden h-full flex items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      statusFilter === 'active'
                        ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-300 group-hover/bar:brightness-125'
                        : statusFilter === 'inactive'
                        ? 'bg-gradient-to-t from-rose-700 via-rose-600 to-pink-400 group-hover/bar:brightness-125'
                        : 'bg-gradient-to-t from-sky-600 via-sky-500 to-cyan-300 group-hover/bar:brightness-125'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>

                {/* Year Label */}
                <span
                  className={`text-[10px] font-mono font-semibold transition-colors mt-0.5 ${
                    isHovered ? 'text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  {item.year}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
