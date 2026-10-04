import React, { useState, useMemo } from 'react';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Users } from '@phosphor-icons/react/Users';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { cn } from '../../lib/cn';

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

type StatusFilter = 'active' | 'all' | 'inactive';

/**
 * Chart palette. Brass is the focus series and the only accent; `info` is the
 * non-focus companion. Never two brass series — a hue that repeats cannot be
 * read as "the one being focused".
 */
const BRASS = '#C8A96A';
const INFO = '#7BA5C7';
const GRID = 'rgba(255,255,255,0.08)';
const MUTED_TICK = '#7c8494';
/** Panel core — the mark stroke that separates a line or slice from the surface. */
const SURFACE = '#0B0C10';
const READOUT_FONT = 'Oxanium, Outfit, sans-serif';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/** Segmented control: one entry per filter, each carrying its own title. */
const FILTERS: Array<{ key: StatusFilter; label: string; title: string }> = [
  { key: 'active', label: 'Aktif', title: 'Anggota Status Aktif (Default)' },
  { key: 'all', label: 'Semua', title: 'Semua Anggota Terdaftar' },
  { key: 'inactive', label: 'Nonaktif', title: 'Anggota Nonaktif' },
];



/** recharts hands the dot renderer the raw datum; only `isBaseline` matters here. */
interface DotDatum {
  isBaseline?: boolean;
}

interface DotRenderProps {
  // recharts types the dot callback's `key` as React.Key | null | undefined, and
  // a parameter type is contravariant, so this must be at least as wide.
  key?: React.Key | null;
  cx?: number;
  cy?: number;
  payload?: DotDatum;
}

interface TooltipEntry {
  payload?: unknown;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

/** The single synthetic anchor the old chart injected. Nothing renders it now;
 *  the guard stays so a stray baseline datum can never draw a fake zero. */
const isBaselineDatum = (datum: unknown): boolean =>
  typeof datum === 'object' && datum !== null && 'isBaseline' in datum && datum.isBaseline === true;

const asStat = (datum: unknown): YearlyMemberStat | undefined =>
  typeof datum === 'object' && datum !== null && 'year' in datum ? (datum as YearlyMemberStat) : undefined;

interface SeriesReadout {
  key: 'active_count' | 'inactive_count';
  label: string;
  /** A series drawn in brass — the chart's one accent. */
  focus: boolean;
}

/** One series table drives the chart, the tooltip, and the legend together, so
 *  a series can never be brass in one place and `info` in another. The focused
 *  series is the one the filter selects; when only one is on screen it is that
 *  one, which keeps the accent on whatever the reader is actually looking at. */
const seriesFor = (filter: StatusFilter): SeriesReadout[] =>
  (
    [
      { key: 'active_count', label: 'Aktif', focus: filter !== 'inactive' },
      { key: 'inactive_count', label: 'Nonaktif', focus: filter === 'inactive' },
    ] as const
  ).filter((s) => filter === 'all' || s.focus);


const CustomLineTooltip: React.FC<CustomTooltipProps & { filter: StatusFilter }> = ({
  active,
  payload,
  label,
  filter,
}) => {
  if (!active || !payload || !payload.length) return null;
  const rawData = asStat(payload[0]?.payload);
  if (!rawData || rawData.isBaseline) return null;

  return (
    <div className="z-toast pointer-events-none min-w-[180px] space-y-2 rounded-panel border border-rule-strong bg-paper-raised px-3 py-2 text-xs shadow-ambient backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 border-b border-rule pb-1.5">
        <span className="font-heading text-xs font-bold text-ink">Tahun {rawData.year || label}</span>
        <span className="font-oxanium text-[11px] font-semibold tabular-nums text-ink-2">
          {rawData.total_count} Total
        </span>
      </div>
      <div className="space-y-1.5 font-oxanium text-[11px] tabular-nums">
        {seriesFor(filter).map((series) => (
          <div
            key={series.key}
            className={cn(
              'flex items-center justify-between gap-3',
              series.focus ? 'text-ink-2' : 'text-info-600'
            )}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn('h-1.5 w-1.5 rounded-full', series.focus ? 'bg-pen-500' : 'bg-info')}
                aria-hidden="true"
              />
              <span>{series.label}</span>
            </span>
            <span className="font-bold">{rawData[series.key]}</span>
          </div>
        ))}
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

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

  // Chart data is the real series only. No synthetic anchor point is injected:
  // a fabricated year reading 0 would be indistinguishable from a real
  // zero-attendance year, and this console never renders an unknown as a zero.
  // A single-year series simply renders as one point rather than a fake line.
  const chartData = useMemo(() => processedStats, [processedStats]);

  const latestYear = useMemo(() => {
    if (processedStats.length === 0) return null;
    return processedStats[processedStats.length - 1].year;
  }, [processedStats]);

  const renderDot = (stroke: string, radius: number) => (props: DotRenderProps) => {
    if (isBaselineDatum(props.payload)) return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} />;
    return (
      <circle
        key={props.key}
        cx={props.cx}
        cy={props.cy}
        r={radius}
        fill={stroke}
        stroke={SURFACE}
        strokeWidth={2}
      />
    );
  };

  return (
    /* Chart container is a static surface: hairline edge only, never a rail. */
    <div className="surface flex h-full min-w-0 flex-col rounded-panel p-4 shadow-ambient sm:p-5">
      {/* Top Header: Title & Filter Pills */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-2">
            <TrendUp size={14} className="text-ink-2" aria-hidden="true" />
            <span>Tren Pendaftaran &amp; Keaktifan</span>
          </span>

          {/* Status Filter Toggle Pills */}
          <div
            className="flex items-center gap-0.5 rounded-panel border border-rule bg-paper-raised p-0.5 text-[10px]"
            role="group"
            aria-label="Filter status anggota pada grafik"
          >
            {FILTERS.map(({ key, label, title }) => {
              const on = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  aria-pressed={on}
                  title={title}
                  className={cn(
                    'flex min-h-[32px] items-center rounded-chip px-2 py-1 font-bold transition-colors',
                    focusRing,
                    on
                      ? 'bg-pen-500 text-paper'
                      : 'text-ink-2 hover:bg-paper-raised/70 hover:text-ink'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Big Number Headline */}
        <div className="mt-2 flex items-baseline gap-2">
          <p className="font-oxanium text-2xl font-bold tabular-nums text-ink sm:text-3xl">
            {loading ? '...' : totalFilteredCount}
          </p>
          <span className="text-xs font-semibold text-ink-2">
            {statusFilter === 'active'
              ? 'Anggota Aktif'
              : statusFilter === 'inactive'
                ? 'Anggota Nonaktif'
                : 'Total Terdaftar'}
          </span>
        </div>
        <p className="mt-0.5 font-oxanium text-[10px] tabular-nums text-ink-2">
          {totalActiveMembers} aktif dari {totalAllMembers} anggota utama
        </p>
      </div>

      {/* Main Chart Area: Recharts LineChart. Explicit height, never collapsed. */}
      <div className="mt-4 flex min-w-0 flex-1 flex-col justify-center border-t border-rule pt-3">
        {hasNoData ? (
          <div className="flex w-full flex-col items-center justify-between gap-3 rounded-panel border border-dashed border-rule-strong bg-paper-raised/40 px-3 py-6 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel border border-rule bg-paper-raised text-ink-2">
                <Users size={16} className="text-info-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Belum Ada Data Anggota</p>
                <p className="mt-0.5 text-[11px] text-ink-2">
                  Tambahkan data anggota organisasi untuk mulai memetakan grafik garis tren tahunan.
                </p>
              </div>
            </div>
            {onAddMember && (
              <button
                type="button"
                onClick={onAddMember}
                className={cn(
                  'flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-panel border border-pen-200 bg-pen-50/70 px-3.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-pen-50',
                  focusRing
                )}
              >
                <UserPlus size={14} aria-hidden="true" />
                <span>Tambah Anggota</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full min-w-0 space-y-2 py-2">
            <div className="h-44 w-full min-w-0 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 24, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                  <XAxis
                    dataKey="year"
                    axisLine={{ stroke: GRID }}
                    tickLine={false}
                    tick={{ fill: MUTED_TICK, fontSize: 11, fontFamily: READOUT_FONT }}
                    dy={6}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, Math.max(2, maxVal + 1)]}
                    axisLine={{ stroke: GRID }}
                    tickLine={false}
                    tick={{ fill: MUTED_TICK, fontSize: 11, fontFamily: READOUT_FONT }}
                    width={32}
                  />
                  <Tooltip
                    content={<CustomLineTooltip filter={statusFilter} />}
                    wrapperStyle={{ zIndex: 70 }}
                  />

                  {/* One entry per series the filter selects. `seriesFor` puts
                      exactly one entry in focus, and a focused entry is brass. */}
                  {seriesFor(statusFilter).map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={`Anggota ${series.label}`}
                      stroke={series.focus ? BRASS : INFO}
                      strokeWidth={series.focus ? 3 : 2.5}
                      strokeDasharray={series.focus ? undefined : '4 4'}
                      dot={renderDot(series.focus ? BRASS : INFO, series.focus ? 5 : 4)}
                      activeDot={{
                        r: series.focus ? 7 : 6,
                        fill: series.focus ? BRASS : INFO,
                        stroke: '#ffffff',
                        strokeWidth: 2,
                      }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend: driven by the same series table as the chart, so a series
                can never be brass on the plot and `info` in the key. */}
            <div className="flex flex-wrap items-center justify-center gap-4 font-oxanium text-[11px] tabular-nums">
              {seriesFor(statusFilter).map((series) => {
                const seriesTotal =
                  series.key === 'active_count'
                    ? totalActiveMembers
                    : Math.max(0, totalAllMembers - totalActiveMembers);
                return (
                  <span
                    key={series.key}
                    className={cn(
                      'flex items-center gap-1.5',
                      series.focus ? 'text-ink-2' : 'text-info-600'
                    )}
                  >
                    <span
                      className={cn('h-2 w-2 rounded-full', series.focus ? 'bg-pen-500' : 'bg-info')}
                      aria-hidden="true"
                    />
                    <span className="font-semibold">
                      {series.label} ({seriesTotal})
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="flex items-center justify-between border-t border-rule px-1 pt-3 font-oxanium text-[11px] tabular-nums text-ink-2">
        <span>{latestYear ? `Angkatan ${latestYear}` : 'Data Anggota'}</span>
        <span className="font-semibold text-ink">Total: {totalAllMembers} Anggota</span>
      </div>
    </div>
  );
};