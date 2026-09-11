import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Building2,
  Calendar,
  QrCode,
  ArrowUpRight,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Activity,
  UserCheck,
  UserX,
} from 'lucide-react';
import { fetchCached } from '../lib/swr-client';
import { Event, MemberActivitySummary } from '@/shared/types';
import { TabKey } from '../components/layout/MobileShell';
import { TopEventsChart, TopEventStatItem } from '../components/dashboard/TopEventsChart';
import { MembersYearlyChart, YearlyMemberStat } from '../components/dashboard/MembersYearlyChart';
import { SkeletonEventList, Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

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

  const loadData = useCallback(async (force = false) => {
    try {
      const [mSummary, dRes, eRes, tRes, topEvRes, yrRes] = await Promise.all([
        fetchCached<{ total: number; active: number; inactive: number }>('/api/members/stats/summary', {
          forceRefresh: force,
          ttlMs: 15_000,
        }).catch(() => null),
        fetchCached<{ divisions: string[] }>('/api/members/divisions', {
          forceRefresh: force,
          ttlMs: 15_000,
        }).catch(() => null),
        fetchCached<{ events: Event[] }>('/api/agenda', {
          forceRefresh: force,
          ttlMs: 15_000,
        }).catch(() => null),
        fetchCached<{ summary: MemberActivitySummary }>('/api/attendances/recap/matrix', {
          forceRefresh: force,
          ttlMs: 15_000,
        }).catch(() => null),
        fetchCached<{ events: TopEventStatItem[] }>('/api/agenda/reports/top-presence', {
          forceRefresh: force,
          ttlMs: 15_000,
        }).catch(() => null),
        fetchCached<{ stats: YearlyMemberStat[] }>('/api/members/stats/yearly-recap', {
          forceRefresh: force,
          ttlMs: 15_000,
        }).catch(() => null),
      ]);

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

  return (
    <div className="space-y-6 animate-in fade-in pb-4">
      {/* Enterprise Operational Command Header */}
      <div className="glass-panel-elevated rounded-2xl p-5 sm:p-6 border border-slate-800 relative overflow-hidden bg-slate-900/90 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Pusat Kendali Presensi • Computer Community</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-white">
            Ringkasan Operasional & Kehadiran
          </h2>
          <p className="text-xs text-slate-400">
            {activeEvents.length > 0
              ? `${activeEvents.length} kegiatan sedang aktif siap menerima validasi presensi QR tiket.`
              : 'Semua kegiatan saat ini dalam status selesai atau draft. Buat kegiatan baru untuk memulai sesi absensi.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <Button
            variant="cyber"
            size="md"
            icon={<QrCode className="w-4 h-4" />}
            onClick={() => onNavigate('scanner')}
          >
            Buka Scanner QR
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Plus className="w-4 h-4 text-sky-400" />}
            onClick={onOpenCreateEvent}
          >
            Buat Kegiatan
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Users className="w-4 h-4 text-sky-400" />}
            onClick={onOpenAddMember}
          >
            Tambah Anggota
          </Button>
        </div>
      </div>

      {/* Level 1: 4 Balanced Uniform KPI Metric Cards (No Cavernous Voids) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Anggota */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800/80 flex items-center justify-between shadow-xl">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
              Total Anggota
            </span>
            {loading ? (
              <div className="h-8 w-16 rounded-lg bg-slate-800 animate-pulse mt-1" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
                {memberStats.total}
              </p>
            )}
            <p className="text-[10px] text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{memberStats.active} aktif</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 ml-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Card 2: Kegiatan Aktif */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800/80 flex items-center justify-between shadow-xl">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
              Kegiatan Aktif
            </span>
            {loading ? (
              <div className="h-8 w-16 rounded-lg bg-slate-800 animate-pulse mt-1" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold font-heading text-sky-400 mt-1">
                {activeEvents.length}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{events.length} total agenda</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 ml-2">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Card 3: Total Presensi Tercatat */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800/80 flex items-center justify-between shadow-xl">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
              Total Presensi
            </span>
            {loading ? (
              <div className="h-8 w-16 rounded-lg bg-slate-800 animate-pulse mt-1" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
                {totalAttendances}
              </p>
            )}
            <p className="text-[10px] text-teal-400 mt-0.5 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
              <span>Tervalidasi sistem</span>
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 ml-2">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Card 4: Divisi Terdata */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800/80 flex items-center justify-between shadow-xl">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
              Divisi Terdata
            </span>
            {loading ? (
              <div className="h-8 w-16 rounded-lg bg-slate-800 animate-pulse mt-1" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
                {divisions.length}
              </p>
            )}
            <p className="text-[10px] text-indigo-400 mt-0.5 font-medium">Bidang divisi aktif</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 ml-2">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Level 2: Dedicated Balanced Analytics Row (50% / 50% on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        <div className="min-w-0 h-full">
          <MembersYearlyChart
            stats={yearlyStats}
            totalActiveMembers={memberStats.active}
            totalAllMembers={memberStats.total}
            loading={loading}
            onAddMember={onOpenAddMember}
          />
        </div>

        <div className="min-w-0 h-full">
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

      {/* Division Distribution & Active Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Events Section (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-lg text-white">Kegiatan yang Sedang Aktif</h3>
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 focus-visible:outline-none focus-visible:underline rounded"
            >
              <span>Semua Event</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <SkeletonEventList count={2} />
          ) : activeEvents.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-8 h-8 text-sky-400" />}
              title="Tidak ada kegiatan aktif saat ini"
              description="Silakan buat kegiatan baru untuk mulai memvalidasi presensi QR kode terenkripsi."
              actionText="Buat Kegiatan Baru"
              actionIcon={<Plus className="w-4 h-4" />}
              onAction={onOpenCreateEvent}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeEvents.map((ev) => (
                <div
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (onNavigateToEvent) {
                      onNavigateToEvent(ev.id);
                    } else {
                      onNavigate('events');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (onNavigateToEvent) {
                        onNavigateToEvent(ev.id);
                      } else {
                        onNavigate('events');
                      }
                    }
                  }}
                  className="glass-panel-interactive rounded-2xl p-4 border border-slate-800/80 hover:border-sky-500/50 cursor-pointer space-y-3 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="emerald" size="sm" pulse>
                      Aktif
                    </Badge>
                    <span className="text-[10px] font-mono text-slate-400">{ev.qr_policy}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white group-hover:text-sky-400 transition-colors truncate">
                      {ev.name}
                    </h4>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {ev.location_name ? `Lokasi: ${ev.location_name}` : 'Lokasi belum ditentukan'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      <span>{ev.attendance_count || 0} Hadir</span>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={<QrCode className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onScanEvent?.(ev);
                      }}
                      aria-label={`Buka kamera scanner untuk ${ev.name}`}
                    >
                      Scan QR
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Member Activity Tracker Summary Card */}
        <div className="glass-panel-elevated rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Keaktifan Anggota</span>
            </h3>
            <button
              onClick={() => onNavigate('tracker')}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
            >
              <span>Detail</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xs text-slate-400">Rata-Rata Kehadiran</span>
            <span className="font-heading font-black text-xl text-sky-400">
              {trackerSummary?.average_attendance_rate ?? 0}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 space-y-0.5">
              <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-400 block">
                Sangat Aktif
              </span>
              <span className="text-lg font-heading font-black text-white">
                {trackerSummary?.highly_active_count ?? 0}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 space-y-0.5">
              <span className="text-[9px] uppercase font-bold tracking-wider text-amber-400 block">
                Cukup Aktif
              </span>
              <span className="text-lg font-heading font-black text-white">
                {trackerSummary?.active_count ?? 0}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                Belum Aktif
              </span>
              <span className="text-lg font-heading font-black text-white">
                {trackerSummary?.inactive_count ?? 0}
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('tracker')}
            className="w-full py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Buka Pelacakan Keaktifan Lengkap</span>
          </button>
        </div>
      </div>
    </div>
  );
};
