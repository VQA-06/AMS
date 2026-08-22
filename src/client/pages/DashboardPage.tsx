import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    async function loadData() {
      try {
        const [mSummary, dRes, eRes, tRes, topEvRes, yrRes] = await Promise.all([
          fetchCached<{ total: number; active: number; inactive: number }>('/api/members/stats/summary').catch(
            () => ({ total: 0, active: 0, inactive: 0 })
          ),
          fetchCached<{ divisions: string[] }>('/api/members/divisions').catch(() => ({ divisions: [] })),
          fetchCached<{ events: Event[] }>('/api/agenda').catch(() => ({ events: [] })),
          fetchCached<{ summary: MemberActivitySummary }>('/api/attendances/recap/matrix').catch(() => null),
          fetchCached<{ events: TopEventStatItem[] }>('/api/agenda/reports/top-presence').catch(() => null),
          fetchCached<{ stats: YearlyMemberStat[] }>('/api/members/stats/yearly-recap').catch(() => null),
        ]);

        const rawEvents = eRes?.events || [];
        setMemberStats(mSummary || { total: 0, active: 0, inactive: 0 });
        setDivisions(dRes?.divisions || []);
        setEvents(rawEvents);
        if (tRes && tRes.summary) {
          setTrackerSummary(tRes.summary);
        }

        // Set Top Events with reliable dataset mapping
        if (topEvRes && topEvRes.events && topEvRes.events.length > 0) {
          setTopEvents(topEvRes.events);
        } else if (rawEvents.length > 0) {
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
    }

    loadData();
  }, []);

  const activeEvents = events.filter((e) => e.status === 'active');

  return (
    <div className="space-y-6 animate-in fade-in pb-4">
      {/* Top Banner */}
      <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden bg-slate-900 shadow-2xl">
        <div className="relative z-10 max-w-xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Computer Community • AMS Pass</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
            Absensi Cepat & Akurat
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Sistem absensi modern Computer Community berbasis tiket JWE AES-256-GCM. Anggota tidak perlu akun, panitia memvalidasi secara instan via scanner mobile.
          </p>

          <div className="flex flex-wrap gap-3 pt-4">
            <button
              onClick={() => onNavigate('scanner')}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/30 active:scale-95 transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>Buka Kamera Scanner</span>
            </button>
            <button
              onClick={onOpenAddMember}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl glass-panel text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Tambah Anggota</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Metric Cards & Yearly Growth Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Graphical Stat Anggota per Tahun (Cohort Growth with Active Default Filter) */}
        <div className="md:col-span-2">
          <MembersYearlyChart
            stats={yearlyStats}
            totalActiveMembers={memberStats.active}
            totalAllMembers={memberStats.total}
            loading={loading}
          />
        </div>

        {/* Total Divisi */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Divisi Terdata
            </span>
            <p className="text-2xl sm:text-3xl font-bold font-heading text-white mt-1">
              {loading ? '...' : divisions.length}
            </p>
            <p className="text-[10px] text-sky-400 mt-0.5">Field Divisi Aktif</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Kegiatan Aktif */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-800 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Kegiatan Aktif
            </span>
            <p className="text-2xl sm:text-3xl font-bold font-heading text-emerald-400 mt-1">
              {loading ? '...' : activeEvents.length}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{events.length} total event</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Interactive Top Events Attendance Graphical Chart */}
      <TopEventsChart
        events={topEvents}
        loading={loading}
        onSelectEvent={(eventId) => {
          if (onNavigateToEvent) {
            onNavigateToEvent(eventId);
          } else {
            onNavigate('events');
          }
        }}
      />

      {/* Division Distribution & Active Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Events Section (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-lg text-white">Kegiatan yang Sedang Aktif</h3>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>Semua Event</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <SkeletonEventList count={2} />
          ) : activeEvents.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center border border-slate-800 animate-in fade-in duration-200">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Tidak ada kegiatan aktif saat ini</p>
              <button
                onClick={onOpenCreateEvent}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Kegiatan Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (onNavigateToEvent) {
                      onNavigateToEvent(ev.id);
                    } else {
                      onNavigate('events');
                    }
                  }}
                  className="glass-panel-elevated rounded-2xl p-4 border border-slate-800 hover:border-sky-500/50 transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Aktif
                    </span>
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

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScanEvent?.(ev);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all shrink-0 select-none"
                      title={`Buka Kamera Scanner untuk kegiatan ${ev.name}`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan QR</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Member Activity Tracker Summary Card */}
        <div className="glass-panel-elevated rounded-3xl p-5 border border-slate-800 space-y-4">
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

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
                Sangat Aktif
              </span>
              <span className="text-xl font-heading font-black text-white">
                {trackerSummary?.highly_active_count ?? 0}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/40 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                Cukup Aktif
              </span>
              <span className="text-xl font-heading font-black text-white">
                {trackerSummary?.active_count ?? 0}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Belum Aktif
              </span>
              <span className="text-xl font-heading font-black text-white">
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
