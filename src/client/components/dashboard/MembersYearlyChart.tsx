import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface YearlyMemberStat {
  year: string;
  active_count: number;
  inactive_count: number;
  total_count: number;
  isBaseline?: boolean;
}

interface MembersYearlyChartProps {
  stats: YearlyMemberStat[];
  totalActiveMembers: number;
  totalAllMembers: number;
  loading?: boolean;
  onAddMember?: () => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
}

const CustomLineTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const rawData = payload[0]?.payload as YearlyMemberStat | undefined;
  if (!rawData || rawData.isBaseline) return null;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 text-xs shadow-2xl backdrop-blur-md min-w-[170px] space-y-2 pointer-events-none z-50">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-mono">
        <span className="font-bold text-sky-400">Tahun {rawData.year || label}</span>
        <span className="text-[11px] text-slate-400 font-semibold">{rawData.total_count} Total</span>
      </div>
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex items-center justify-between gap-3 text-emerald-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Aktif</span>
          </span>
          <span className="font-bold">{rawData.active_count}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>Nonaktif</span>
          </span>
          <span className="font-bold">{rawData.inactive_count}</span>
        </div>
      </div>
    </div>
  );
};

export const MembersYearlyChart: React.FC<MembersYearlyChartProps> = ({
  stats,
  totalActiveMembers,
  totalAllMembers,
  loading = false,
  onAddMember,
}) => {
  // Default filter: 'active' as explicitly requested by user
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');

  // Pure data from backend - zero synthetic dummy fallback
  const processedStats = useMemo(() => stats || [], [stats]);

  const maxVal = useMemo(() => {
    if (processedStats.length === 0) return 1;
    const values = processedStats.map((s) => {
      if (statusFilter === 'active') return s.active_count;
      if (statusFilter === 'inactive') return s.inactive_count;
      return s.total_count;
    });
    return Math.max(...values, 1);
  }, [processedStats, statusFilter]);

  const totalFilteredCount = useMemo(() => {
    if (processedStats.length === 0) {
      if (statusFilter === 'active') return totalActiveMembers;
      if (statusFilter === 'inactive') return Math.max(0, totalAllMembers - totalActiveMembers);
      return totalAllMembers;
    }
    return processedStats.reduce((acc, s) => {
      if (statusFilter === 'active') return acc + s.active_count;
      if (statusFilter === 'inactive') return acc + s.inactive_count;
      return acc + s.total_count;
    }, 0);
  }, [processedStats, statusFilter, totalActiveMembers, totalAllMembers]);

  const hasNoData = totalAllMembers === 0 || processedStats.length === 0;

  // Chart data: if only 1 data point, prepend a baseline anchor (0 count from bottom) so a line is visibly drawn
  const chartData = useMemo(() => {
    if (processedStats.length === 0) return [];
    if (processedStats.length === 1) {
      const firstYear = processedStats[0].year;
      const numYear = parseInt(firstYear, 10);
      const prevYear = !isNaN(numYear) ? String(numYear - 1) : 'Awal';
      return [
        {
          year: prevYear,
          active_count: 0,
          inactive_count: 0,
          total_count: 0,
          isBaseline: true,
        },
        processedStats[0],
      ];
    }
    return processedStats;
  }, [processedStats]);

  const latestYear = useMemo(() => {
    if (processedStats.length === 0) return null;
    return processedStats[processedStats.length - 1].year;
  }, [processedStats]);

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group shadow-xl h-full min-w-0">
      {/* Top Header: Title & Filter Pills */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tren Pendaftaran & Keaktifan</span>
          </span>

          {/* Status Filter Toggle Pills */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px]">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all min-h-[32px] sm:min-h-0 flex items-center ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Anggota Status Aktif (Default)"
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all min-h-[32px] sm:min-h-0 flex items-center ${
                statusFilter === 'all'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Semua Anggota Terdaftar"
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all min-h-[32px] sm:min-h-0 flex items-center ${
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
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span>{totalActiveMembers} aktif dari {totalAllMembers} anggota utama</span>
        </p>
      </div>

      {/* Main Chart Area: Recharts LineChart with Baseline Anchor */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex-1 flex flex-col justify-center min-w-0">
        {hasNoData ? (
          <div className="py-6 px-3 w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800/80 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-300">Belum Ada Data Anggota</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tambahkan data anggota organisasi untuk mulai memetakan grafik garis tren tahunan.
                </p>
              </div>
            </div>
            {onAddMember && (
              <button
                type="button"
                onClick={onAddMember}
                className="min-h-[44px] sm:min-h-0 px-3.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <span>+ Tambah Anggota</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full min-w-0 py-2 space-y-2">
            <div className="w-full h-44 sm:h-48 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 16, right: 24, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(148, 163, 184, 0.12)"
                  />
                  <XAxis
                    dataKey="year"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    dy={6}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, Math.max(2, maxVal + 1)]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    width={28}
                  />
                  <Tooltip
                    content={<CustomLineTooltip />}
                    wrapperStyle={{ zIndex: 50 }}
                  />

                  {statusFilter === 'active' && (
                    <Line
                      type="monotone"
                      dataKey="active_count"
                      name="Anggota Aktif"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={(props: any) => {
                        if (props.payload?.isBaseline) return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} />;
                        return (
                          <circle
                            key={props.key}
                            cx={props.cx}
                            cy={props.cy}
                            r={5}
                            fill="#10b981"
                            stroke="#0d1527"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 7, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}

                  {statusFilter === 'inactive' && (
                    <Line
                      type="monotone"
                      dataKey="inactive_count"
                      name="Anggota Nonaktif"
                      stroke="#64748b"
                      strokeWidth={3}
                      dot={(props: any) => {
                        if (props.payload?.isBaseline) return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} />;
                        return (
                          <circle
                            key={props.key}
                            cx={props.cx}
                            cy={props.cy}
                            r={5}
                            fill="#64748b"
                            stroke="#0d1527"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 7, fill: '#94a3b8', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}

                  {statusFilter === 'all' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="active_count"
                        name="Aktif"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={(props: any) => {
                          if (props.payload?.isBaseline) return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} />;
                          return (
                            <circle
                              key={props.key}
                              cx={props.cx}
                              cy={props.cy}
                              r={5}
                              fill="#10b981"
                              stroke="#0d1527"
                              strokeWidth={2}
                            />
                          );
                        }}
                        activeDot={{ r: 7, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="inactive_count"
                        name="Nonaktif"
                        stroke="#64748b"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={(props: any) => {
                          if (props.payload?.isBaseline) return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} />;
                          return (
                            <circle
                              key={props.key}
                              cx={props.cx}
                              cy={props.cy}
                              r={4}
                              fill="#64748b"
                              stroke="#0d1527"
                              strokeWidth={2}
                            />
                          );
                        }}
                        activeDot={{ r: 6, fill: '#94a3b8', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Clean Minimalist Legend */}
            <div className="flex items-center justify-center gap-4 text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold">Aktif ({totalActiveMembers})</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="font-semibold">Nonaktif ({Math.max(0, totalAllMembers - totalActiveMembers)})</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/60 pt-3 px-1">
        <span className="text-slate-400">
          {latestYear ? `Angkatan ${latestYear}` : 'Data Anggota'}
        </span>
        <span className="text-white font-semibold">
          Total: {totalAllMembers} Anggota
        </span>
      </div>
    </div>
  );
};
