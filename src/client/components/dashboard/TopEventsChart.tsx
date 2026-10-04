import React, { useState, useMemo } from 'react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { Trophy } from '@phosphor-icons/react/Trophy';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { EventStatus, QrPolicy } from '@/shared/types';
import { Badge, BadgeVariant } from '../ui/Badge';
import { cn } from '../../lib/cn';

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

type PeriodFilter = 'all' | 'year' | '30days';
type StatusFilter = 'all' | 'active' | 'closed';
type SortKey = 'attendance' | 'recent';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/**
 * Donut palette. Index 0 — the top-ranked event, the one the reader lands on —
 * is brass, the single accent. The remainder are non-focus and step through
 * `info` and the slate ramp; a second brass slice would say "two things matter"
 * and mean neither.
 */
const SLICE_PALETTE = ['#C8A96A', '#7BA5C7', '#4FA88B', '#D9A441', '#8b93a7'] as const;
const SURFACE = '#0B0C10';

/** Tooltip status chip. Copy and hue both mirror the readiness list below. */
const statusChip = (status: EventStatus): { label: string; variant: BadgeVariant } =>
  status === 'active'
    ? { label: 'Aktif', variant: 'seal' }
    : { label: 'Selesai', variant: 'neutral' };

/** Readiness list chip: an event that has not opened is "Draft" regardless of
 *  whether it is scheduled for later or already closed. */
const readinessChip = (status: EventStatus): { label: string; variant: BadgeVariant } =>
  status === 'active'
    ? { label: 'Siap Scan', variant: 'seal' }
    : { label: 'Draft', variant: 'pending' };

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'year', label: 'Tahun Ini' },
  { value: '30days', label: '30 Hari' },
];

const SELECT_CLASS =
  'min-h-[36px] cursor-pointer rounded-panel border border-rule-strong bg-paper-raised px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-pen-200 focus-visible:border-pen-500';

interface PieDatum {
  id: string;
  name: string;
  value: number;
  fill: string;
  attendance_count: number;
  member_count: number;
  guest_count: number;
  location_name: string | null;
  status: EventStatus;
}

interface TooltipEntry {
  payload?: unknown;
}

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  totalAttendees: number;
}

const asPieDatum = (datum: unknown): PieDatum | undefined =>
  typeof datum === 'object' && datum !== null && 'fill' in datum ? (datum as PieDatum) : undefined;

const CustomPieTooltip: React.FC<CustomPieTooltipProps> = ({ active, payload, totalAttendees }) => {
  if (!active || !payload || !payload.length) return null;
  const item = asPieDatum(payload[0]?.payload);
  if (!item) return null;

  const chip = statusChip(item.status);
  const totalPct = totalAttendees > 0 ? Math.round((item.attendance_count / totalAttendees) * 100) : 0;

  return (
    <div className="z-toast pointer-events-none max-w-[260px] space-y-2 rounded-panel border border-rule-strong bg-paper-raised px-3 py-2 text-xs backdrop-blur-md">
      <div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.fill }}
            aria-hidden="true"
          />
          <p className="line-clamp-1 font-heading text-xs font-bold text-ink">{item.name}</p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={chip.variant} size="xs">
            {chip.label}
          </Badge>
          {item.location_name && (
            <span className="max-w-[140px] truncate text-[10px] text-ink-2">{item.location_name}</span>
          )}
        </div>
      </div>
      <div className="space-y-1 border-t border-rule pt-1.5 font-oxanium text-[11px] tabular-nums">
        <div className="flex items-center justify-between gap-3 text-ink-2">
          <span>Total Presensi:</span>
          <span className="font-bold">{item.attendance_count} hadir</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[10px] text-ink-2">
          <span>Komposisi:</span>
          <span>
            {item.member_count || 0} Anggota • {item.guest_count || 0} Tamu
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[10px] text-ink-2">
          <span>Pangsa Kehadiran:</span>
          <span>{totalPct}% dari total</span>
        </div>
      </div>
    </div>
  );
};

export const TopEventsChart: React.FC<TopEventsChartProps> = ({
  events,
  loading = false,
  onSelectEvent,
  onOpenScanner,
}) => {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('attendance');

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

  // Donut data for Recharts PieChart. Events with no attendance are excluded
  // rather than rendered as a zero-width slice: a slice sized 0 is a mark that
  // says "this event has no attendance", which is what the empty state below
  // already says in words.
  const pieData = useMemo<PieDatum[]>(() => {
    const validEvents = filteredEvents.filter((ev) => (ev.attendance_count || 0) > 0);
    if (validEvents.length === 0) return [];
    return validEvents.slice(0, 5).map((ev, idx) => ({
      id: ev.id,
      name: ev.name,
      value: ev.attendance_count || 0,
      fill: SLICE_PALETTE[idx % SLICE_PALETTE.length],
      attendance_count: ev.attendance_count || 0,
      member_count: ev.member_count || 0,
      guest_count: ev.guest_count || 0,
      location_name: ev.location_name,
      status: ev.status,
    }));
  }, [filteredEvents]);

  // Events present but never scanned — named, never folded into "0".
  const unscannedEvents = useMemo(
    () => filteredEvents.filter((ev) => (ev.attendance_count || 0) === 0),
    [filteredEvents]
  );

  return (
    /* Chart container is a static surface: hairline edge only, never a rail. */
    <div className="surface flex h-full min-w-0 flex-col space-y-4 rounded-panel p-4 sm:p-5">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-3 border-b border-rule pb-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-2">
              <Trophy size={14} className="text-ink-2" aria-hidden="true" />
              <span>Sebaran Kehadiran Kegiatan</span>
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-2">
            Peringkat dan volume kehadiran presensi per agenda kegiatan
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex w-full flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
          {/* Period Filter */}
          <div
            className="flex items-center gap-0.5 rounded-panel border border-rule bg-paper-raised p-0.5 text-[11px]"
            role="group"
            aria-label="Filter periode kegiatan"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const on = periodFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriodFilter(opt.value)}
                  aria-pressed={on}
                  className={cn(
                    'flex min-h-[32px] items-center rounded-chip px-2.5 py-1 font-semibold transition-colors',
                    focusRing,
                    on ? 'bg-pen-500 font-bold text-paper' : 'text-ink-2 hover:bg-paper-raised/70 hover:text-ink'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Status Select */}
          <select
            id="top-events-chart-status-filter"
            aria-label="Filter status kegiatan"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cn(SELECT_CLASS, focusRing)}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif Saja</option>
            <option value="closed">Selesai Saja</option>
          </select>

          {/* Sort Select */}
          <select
            id="top-events-chart-sort"
            aria-label="Urutkan kegiatan"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className={cn(SELECT_CLASS, focusRing)}
          >
            <option value="attendance">Peserta Terbanyak</option>
            <option value="recent">Kegiatan Terbaru</option>
          </select>
        </div>
      </div>

      {/* Main Graphical Display: Pure Centered Recharts PieChart (No List, Clean Z-Index) */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
        {loading ? (
          <div className="py-12 text-center text-xs font-semibold text-ink-2" role="status" aria-live="polite">
            Memuat sebaran data kegiatan...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="w-full space-y-1 rounded-panel border border-dashed border-rule-strong px-4 py-12 text-center text-xs text-ink-2">
            <p className="font-semibold text-ink">Tidak ada kegiatan yang sesuai filter</p>
            <p className="text-[11px]">Coba ubah filter periode atau status kegiatan di atas.</p>
          </div>
        ) : totalAttendees === 0 ? (
          /* Actionable Zero-Attendance State: named, not a zero-length ring. */
          <div className="w-full space-y-3">
            <div className="flex flex-col items-center justify-between gap-3 rounded-panel border border-dashed border-rule-strong bg-paper-raised/40 px-4 py-4 text-center sm:flex-row sm:text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-panel border border-rule bg-paper-raised text-ink-2">
                  <CalendarBlank size={20} className="text-ink-2" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">Belum Ada Presensi Tercatat</p>
                  <p className="mt-0.5 text-[11px] text-ink-2">
                    {filteredEvents.length} kegiatan terdaftar siap menerima pemindaian absensi tiket QR.
                  </p>
                </div>
              </div>
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className={cn(
                    'flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-panel border border-pen-200 bg-pen-50/70 px-3.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-pen-50',
                    focusRing
                  )}
                >
                  <span>Buka Scanner QR</span>
                </button>
              )}
            </div>

            {/* Event Readiness List — each row carries a jade/ochre rail by state,
                so the rail varies per row rather than decorating a constant hue. */}
            <div className="space-y-2">
              {filteredEvents.slice(0, 3).map((ev, idx) => {
                const chip = readinessChip(ev.status);
                return (
                  <div
                    key={ev.id}
                    onClick={() => onSelectEvent?.(ev.id)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-panel border border-rule bg-paper-raised/40 transition-colors hover:border-pen-200"
                  >
                    <div className="flex min-w-0 items-stretch">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'rail self-stretch',
                          ev.status === 'active' ? 'bg-seal-500' : 'bg-ink-3'
                        )}
                      />
                      <span aria-hidden="true" className="w-3 shrink-0" />
                      <div className="flex min-w-0 items-center gap-2.5 py-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-chip border border-rule bg-paper-raised font-oxanium text-[10px] font-bold tabular-nums text-ink-2">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-ink">{ev.name}</p>
                          {ev.location_name && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-ink-2">
                              <MapPin size={12} className="shrink-0 text-ink-3" aria-hidden="true" />
                              <span>{ev.location_name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pr-2.5">
                      <Badge variant={chip.variant} size="xs">
                        {chip.label}
                      </Badge>
                      <CaretRight size={14} className="text-ink-3" aria-hidden="true" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Pure Recharts Donut PieChart Hero (Centered, Spacious, Zero Overlap) */
          <div className="flex w-full flex-col items-center justify-center space-y-3 py-2">
            {/* Centered Donut with Proper Z-Index */}
            <div className="relative flex h-44 w-44 items-center justify-center sm:h-48 sm:w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={<CustomPieTooltip totalAttendees={totalAttendees} />}
                    wrapperStyle={{ zIndex: 70 }}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={56}
                    outerRadius={74}
                    stroke={SURFACE}
                    strokeWidth={3}
                    cornerRadius={6}
                    paddingAngle={pieData.length > 1 ? 4 : 0}
                    onClick={(entry) => {
                      // recharts widens the sector datum to an index-signature
                      // object; only `id` is read, so narrow through a guard
                      // rather than trusting the shape.
                      if (!onSelectEvent || typeof entry !== 'object' || entry === null) return;
                      const id: unknown = 'id' in entry ? entry.id : undefined;
                      if (typeof id === 'string' && id.length > 0) onSelectEvent(id);
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
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center">
                <span className="font-oxanium text-3xl font-extrabold tabular-nums tracking-tight text-ink sm:text-4xl">
                  {totalAttendees}
                </span>
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-2">
                  Total Hadir
                </span>
              </div>
            </div>

            {/* Legend tags double as the keyboard-reachable path into each slice. */}
            <div className="flex max-w-md flex-wrap items-center justify-center gap-2 pt-1">
              {pieData.map((ev) => {
                const totalPct = totalAttendees > 0 ? Math.round((ev.value / totalAttendees) * 100) : 0;

                return (
                  <button
                    type="button"
                    key={ev.id}
                    onClick={() => onSelectEvent?.(ev.id)}
                    aria-label={`${ev.name}: ${ev.value} hadir (${totalPct}%)`}
                    className={cn(
                      'flex items-center gap-1.5 rounded-chip border border-rule bg-paper-raised px-3 py-1 font-oxanium text-[11px] tabular-nums transition-colors hover:border-pen-200',
                      focusRing
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.fill }}
                      aria-hidden="true"
                    />
                    <span className="max-w-[120px] truncate font-semibold">{ev.name}</span>
                    <span className="text-ink-2">({ev.value})</span>
                  </button>
                );
              })}
            </div>

            {unscannedEvents.length > 0 && (
              <p className="w-full text-center text-[11px] text-ink-2">
                {unscannedEvents.length} kegiatan lain pada rentang ini belum mencatat presensi, sehingga
                tidak tampil sebagai irisan.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="flex items-center justify-between border-t border-rule pt-3 font-oxanium text-[11px] tabular-nums text-ink-2">
        <span>
          Total Terdata: <strong className="font-bold text-ink">{totalAttendees}</strong> Presensi
        </span>
        <span>{filteredEvents.length} Kegiatan Terdaftar</span>
      </div>
    </div>
  );
};