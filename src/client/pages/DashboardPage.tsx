import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/ArrowUpRight';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { Plus } from '@phosphor-icons/react/Plus';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { Users } from '@phosphor-icons/react/Users';
import { Warning } from '@phosphor-icons/react/Warning';
import { fetchCached } from '../lib/swr-client';
import { Event, MemberActivitySummary } from '@/shared/types';
import { TabKey } from '../components/layout/MobileShell';
import { TopEventsChart, TopEventStatItem } from '../components/dashboard/TopEventsChart';
import { MembersYearlyChart, YearlyMemberStat } from '../components/dashboard/MembersYearlyChart';
import { SkeletonEventList } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Stat } from '../components/ui/Stat';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

interface DashboardPageProps {
  onNavigate: (tab: TabKey) => void;
  onNavigateToEvent?: (eventId: string) => void;
  onScanEvent?: (event: Event) => void;
  onOpenAddMember: () => void;
  onOpenCreateEvent: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onNavigateToEvent,
  onScanEvent,
  onOpenAddMember,
  onOpenCreateEvent,
}) => {
  const [memberStats, setMemberStats] = useState<{ total: number; active: number; inactive: number }>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [divisions, setDivisions] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [topEvents, setTopEvents] = useState<TopEventStatItem[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyMemberStat[]>([]);
  const [trackerSummary, setTrackerSummary] = useState<MemberActivitySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  /** Endpoints that failed; the dashboard renders partial data with a warning. */
  const [partialErrors, setPartialErrors] = useState<string[]>([]);

  const loadData = useCallback(async (force = false) => {
    try {
      const settled = await Promise.allSettled([
        fetchCached<{ total: number; active: number; inactive: number }>('/api/members/stats/summary', {
          forceRefresh: force,
          ttlMs: 15_000,
        }),
        fetchCached<{ divisions: string[] }>('/api/members/divisions', {
          forceRefresh: force,
          ttlMs: 15_000,
        }),
        fetchCached<{ events: Event[] }>('/api/agenda', {
          forceRefresh: force,
          ttlMs: 15_000,
        }),
        fetchCached<{ summary: MemberActivitySummary }>('/api/attendances/recap/matrix', {
          forceRefresh: force,
          ttlMs: 15_000,
        }),
        fetchCached<{ events: TopEventStatItem[] }>('/api/agenda/reports/top-presence', {
          forceRefresh: force,
          ttlMs: 15_000,
        }),
        fetchCached<{ stats: YearlyMemberStat[] }>('/api/members/stats/yearly-recap', {
          forceRefresh: force,
          ttlMs: 15_000,
        }),
      ]);

      // Surface which sections could not load. Silently rendering them as
      // empty made a partial outage indistinguishable from real zero counts.
      const failedLabels = ['Statistik Anggota', 'Divisi', 'Agenda', 'Rekap Keaktifan', 'Top Kegiatan', 'Rekap Tahunan'];
      setPartialErrors(settled.flatMap((r, i) => (r.status === 'rejected' ? [failedLabels[i]] : [])));

      const [mSummary, dRes, eRes, tRes, topEvRes, yrRes] = settled.map((r) =>
        r.status === 'fulfilled' ? r.value : null
      ) as [
        { total: number; active: number; inactive: number } | null,
        { divisions: string[] } | null,
        { events: Event[] } | null,
        { summary: MemberActivitySummary } | null,
        { events: TopEventStatItem[] } | null,
        { stats: YearlyMemberStat[] } | null,
      ];

      const rawEvents = eRes?.events;
      if (mSummary) {
        setMemberStats(mSummary);
      }
      if (dRes?.divisions) {
        setDivisions(dRes.divisions);
      }
      if (rawEvents) {
        setEvents(rawEvents);
      }
      if (tRes && tRes.summary) {
        setTrackerSummary(tRes.summary);
      }

      // Set Top Events with reliable dataset mapping
      if (topEvRes && topEvRes.events && topEvRes.events.length > 0) {
        setTopEvents(topEvRes.events);
      } else if (rawEvents && rawEvents.length > 0) {
        setTopEvents(
          rawEvents.map((ev) => ({
            id: ev.id,
            name: ev.name,
            status: ev.status,
            starts_at: ev.starts_at,
            ends_at: ev.ends_at,
            qr_policy: ev.qr_policy,
            location_name: ev.location_name,
            attendance_count: ev.attendance_count || 0,
            checkin_count: ev.checkin_count || 0,
            checkout_count: ev.checkout_count || 0,
            guest_count: ev.guest_count || 0,
            member_count: ev.member_count || 0,
          }))
        );
      }

      if (yrRes && yrRes.stats && yrRes.stats.length > 0) {
        setYearlyStats(yrRes.stats);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen for realtime mutation events across tabs and modals
    const handleMutation = () => {
      loadData(true);
    };

    window.addEventListener('ams:data-mutated', handleMutation);
    return () => {
      window.removeEventListener('ams:data-mutated', handleMutation);
    };
  }, [loadData]);

  const activeEvents = events.filter((e) => e.status === 'active');
  const totalAttendances = useMemo(() => {
    return topEvents.reduce((acc, ev) => acc + (ev.attendance_count || 0), 0);
  }, [topEvents]);

  // A section that failed must not render a number. `0` is a legitimate answer
  // for "no divisions", so printing it during an outage is a plausible lie the
  // banner alone does not fully offset. Unknown renders as a dash.
  const unknownFigure = (
    <span className="text-ink-3" title="Gagal dimuat">
      &mdash;
    </span>
  );
  const failed = (label: string) => partialErrors.includes(label);
  const statValue = (label: string, value: React.ReactNode) =>
    loading ? loadingFigure : failed(label) ? unknownFigure : value;

  // One shimmer system for every loading placeholder on the page, sized like the
  // figure it stands in for so the tile height never jumps on load.
  const loadingFigure = (
    <span
      aria-hidden="true"
      className="skeleton-shimmer inline-block h-8 w-16 rounded-chip align-middle"
    />
  );

  return (
    <div className="space-y-5 pb-4 md:space-y-8">
      {partialErrors.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-panel border border-pending-200 bg-pending-50/70 px-4 py-3 text-xs text-pending-800"
        >
          <Warning className="mt-0.5 h-4 w-4 shrink-0 text-pending-600" weight="bold" />
          <span>
            Sebagian data gagal dimuat: {partialErrors.join(', ')}. Angka di bawah
            mungkin tidak lengkap, bukan nol.
          </span>
        </div>
      )}

      <PageHeader
        title="Ringkasan Operasional & Kehadiran"
        subtitle={
          activeEvents.length > 0
            ? `${activeEvents.length} kegiatan sedang aktif siap menerima validasi presensi QR tiket.`
            : 'Semua kegiatan saat ini dalam status selesai atau draft. Buat kegiatan baru untuk memulai sesi absensi.'
        }
        actions={
          <>
            <Button
              variant="primary"
              size="md"
              icon={<QrCode className="h-4 w-4" />}
              onClick={() => onNavigate('scanner')}
            >
              Buka Scanner QR
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<Plus className="h-4 w-4 text-ink-2" />}
              onClick={onOpenCreateEvent}
            >
              Buat Kegiatan
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<Users className="h-4 w-4 text-ink-2" />}
              onClick={onOpenAddMember}
            >
              Tambah Anggota
            </Button>
          </>
        }
      />

      {/* One uniform row of four. Rails only where the figure's state varies —
          "Kegiatan Aktif" flips between jade and idle; the other three are a
          constant count and would be decoration. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Total Anggota"
          value={statValue('Statistik Anggota', memberStats.total)}
          hint={failed('Statistik Anggota') ? 'Gagal dimuat' : `${memberStats.active} aktif`}
          icon={<Users />}
        />
        <Stat
          label="Kegiatan Aktif"
          value={statValue('Agenda', activeEvents.length)}
          mark={failed('Agenda') ? undefined : activeEvents.length > 0 ? 'seal' : 'idle'}
          hint={failed('Agenda') ? 'Gagal dimuat' : `${events.length} total agenda`}
          icon={<CalendarBlank />}
        />
        <Stat
          label="Total Presensi Tercatat"
          value={statValue('Top Kegiatan', totalAttendances)}
          hint={failed('Top Kegiatan') ? 'Gagal dimuat' : 'Tervalidasi sistem'}
        />
        <Stat
          label="Divisi Terdata"
          value={statValue('Divisi', divisions.length)}
          hint={failed('Divisi') ? 'Gagal dimuat' : 'Bidang divisi aktif'}
        />
      </div>

      {/* Analytics row */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="h-full min-w-0">
          <MembersYearlyChart
            stats={yearlyStats}
            totalActiveMembers={memberStats.active}
            totalAllMembers={memberStats.total}
            loading={loading}
            onAddMember={onOpenAddMember}
          />
        </div>

        <div className="h-full min-w-0">
          <TopEventsChart
            events={topEvents}
            loading={loading}
            onOpenScanner={() => onNavigate('scanner')}
            onSelectEvent={(eventId) => {
              if (onNavigateToEvent) {
                onNavigateToEvent(eventId);
              } else {
                onNavigate('events');
              }
            }}
          />
        </div>
      </div>

      {/* Active events + activity tracker */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="min-w-0 space-y-4 lg:col-span-2" aria-labelledby="dashboard-page-active-events">
          <div className="flex items-center justify-between gap-3">
            <h2 id="dashboard-page-active-events" className="font-heading text-base font-bold text-white">
              Kegiatan yang Sedang Aktif
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-chip text-xs font-semibold text-ink-2 transition-colors hover:text-ink-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
              )}
            >
              <span>Semua Event</span>
              <ArrowUpRight className="h-3.5 w-3.5" weight="bold" />
            </button>
          </div>

          {loading ? (
            <SkeletonEventList count={2} />
          ) : activeEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarBlank className="h-8 w-8 text-ink-2" />}
              title="Tidak ada kegiatan aktif saat ini"
              description="Silakan buat kegiatan baru untuk mulai memvalidasi presensi QR kode terenkripsi."
              actionText="Buat Kegiatan Baru"
              actionIcon={<Plus className="h-4 w-4" />}
              onAction={onOpenCreateEvent}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeEvents.map((ev) => (
                <li key={ev.id} className="min-w-0">
                  {/* Constant jade rail on a jade-only list would be decoration;
                      the "Aktif" badge already carries the state. */}
                  <Card className="group h-full p-4 transition-colors hover:border-pen-200">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="seal" size="sm" pulse>
                        Aktif
                      </Badge>
                      <span className="truncate font-oxanium text-[10px] text-ink-2">{ev.qr_policy}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToEvent) {
                          onNavigateToEvent(ev.id);
                        } else {
                          onNavigate('events');
                        }
                      }}
                      className={cn(
                        'mt-3 block w-full min-w-0 text-left',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper rounded-chip',
                      )}
                    >
                      <h3 className="truncate text-base font-bold text-white transition-colors group-hover:text-ink-2">
                        {ev.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-ink-2">
                        {ev.location_name ? `Lokasi: ${ev.location_name}` : 'Lokasi belum ditentukan'}
                      </p>
                    </button>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-3">
                      <div className="flex min-w-0 items-center gap-1.5 font-oxanium text-[11px] text-ink-2">
                        <Users className="h-3.5 w-3.5 shrink-0 text-ink-2" weight="bold" />
                        <span className="truncate">{ev.attendance_count || 0} Hadir</span>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        icon={<QrCode className="h-3.5 w-3.5" />}
                        onClick={() => onScanEvent?.(ev)}
                        aria-label={`Buka kamera scanner untuk ${ev.name}`}
                      >
                        Scan QR
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card className="min-w-0 space-y-3.5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex min-w-0 items-center gap-2 font-display text-base font-semibold text-ink">
              <ChartLineUp className="h-4 w-4 shrink-0 text-seal-600" weight="bold" />
              <span className="truncate">Keaktifan Anggota</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('tracker')}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-chip text-xs font-semibold text-ink-2 transition-colors hover:text-ink-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
              )}
            >
              <span>Detail</span>
              <ArrowUpRight className="h-3 w-3" weight="bold" />
            </button>
          </div>

          <div className="flex items-baseline justify-between gap-2 pt-1">
            <span className="min-w-0 truncate text-xs text-ink-2">Rata-Rata Kehadiran</span>
            <span className="font-oxanium text-xl font-bold tabular-nums text-ink-2">
              {trackerSummary?.average_attendance_rate ?? 0}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="surface-raised space-y-0.5 rounded-chip p-2.5">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-seal-600">
                Sangat Aktif
              </span>
              <span className="font-oxanium text-lg font-bold tabular-nums text-white">
                {trackerSummary?.highly_active_count ?? 0}
              </span>
            </div>

            <div className="surface-raised space-y-0.5 rounded-chip p-2.5">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-pending-600">
                Cukup Aktif
              </span>
              <span className="font-oxanium text-lg font-bold tabular-nums text-white">
                {trackerSummary?.active_count ?? 0}
              </span>
            </div>

            <div className="surface-raised space-y-0.5 rounded-chip p-2.5">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-ink-2">
                Belum Aktif
              </span>
              <span className="font-oxanium text-lg font-bold tabular-nums text-white">
                {trackerSummary?.inactive_count ?? 0}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('tracker')}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-chip py-2 text-xs font-semibold text-ink transition-colors hover:bg-paper-raised hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
            )}
          >
            <ChartLineUp className="h-3.5 w-3.5 text-ink-2" weight="bold" />
            <span>Buka Pelacakan Keaktifan Lengkap</span>
          </button>
        </Card>
      </div>
    </div>
  );
};
