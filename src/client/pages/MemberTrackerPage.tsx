import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Search,
  Building2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  UserX,
  Clock,
  Filter,
} from 'lucide-react';
import { MemberActivityEntry, MemberActivitySummary, ActivityTier } from '@/shared/types';
import { fetchApi } from '../lib/api-client';

export const MemberTrackerPage: React.FC = () => {
  const [entries, setEntries] = useState<MemberActivityEntry[]>([]);
  const [summary, setSummary] = useState<MemberActivitySummary | null>(null);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedTier, setSelectedTier] = useState<'all' | ActivityTier>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDivision && selectedDivision !== 'all') {
        params.set('division', selectedDivision);
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (selectedTier !== 'all') {
        params.set('tier', selectedTier);
      }

      const [trackerRes, divRes] = await Promise.all([
        fetchApi<{
          entries: MemberActivityEntry[];
          summary: MemberActivitySummary;
        }>(`/api/attendances/recap/matrix?${params.toString()}`),
        fetchApi<{ divisions: string[] }>('/api/members/divisions').catch(() => ({ divisions: [] })),
      ]);

      setEntries(trackerRes.entries || []);
      setSummary(trackerRes.summary || null);
      setDivisions(divRes.divisions || []);
    } catch (err) {
      console.error('Failed to load member activity tracker:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDivision, search, selectedTier]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getTierBadge = (tier: ActivityTier) => {
    switch (tier) {
      case 'highly_active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sangat Aktif
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-800/60 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Cukup Aktif
          </span>
        );
      case 'inactive':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/60">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Belum / Kurang Aktif
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-sky-400" />
            <span>Pelacakan Keaktifan Anggota</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pantau tingkat partisipasi dan kehadiran anggota pada setiap kegiatan Computer Community
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto p-2.5 glass-panel text-slate-400 hover:text-white rounded-xl transition-colors flex items-center gap-2 text-xs font-semibold"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="sm:hidden">Segarkan Data</span>
        </button>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel-elevated rounded-3xl p-4 sm:p-5 border border-emerald-900/40 shadow-lg relative overflow-hidden group">
          <div className="absolute right-3 top-3 w-10 h-10 rounded-2xl bg-emerald-950/60 flex items-center justify-center border border-emerald-800/40 text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sangat Aktif</p>
          <h3 className="text-2xl sm:text-3xl font-black font-heading text-white mt-1">
            {summary?.highly_active_count ?? 0}
          </h3>
          <p className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Kehadiran Tinggi</span>
          </p>
        </div>

        <div className="glass-panel-elevated rounded-3xl p-4 sm:p-5 border border-amber-900/40 shadow-lg relative overflow-hidden group">
          <div className="absolute right-3 top-3 w-10 h-10 rounded-2xl bg-amber-950/60 flex items-center justify-center border border-amber-800/40 text-amber-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cukup Aktif</p>
          <h3 className="text-2xl sm:text-3xl font-black font-heading text-white mt-1">
            {summary?.active_count ?? 0}
          </h3>
          <p className="text-[11px] text-amber-400 font-semibold mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Kehadiran Sedang</span>
          </p>
        </div>

        <div className="glass-panel-elevated rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-lg relative overflow-hidden group">
          <div className="absolute right-3 top-3 w-10 h-10 rounded-2xl bg-slate-900/80 flex items-center justify-center border border-slate-700/60 text-slate-400">
            <UserX className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Belum Aktif</p>
          <h3 className="text-2xl sm:text-3xl font-black font-heading text-white mt-1">
            {summary?.inactive_count ?? 0}
          </h3>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>Perlu Follow-up</span>
          </p>
        </div>

        <div className="glass-panel-elevated rounded-3xl p-4 sm:p-5 border border-sky-900/40 shadow-lg relative overflow-hidden group">
          <div className="absolute right-3 top-3 w-10 h-10 rounded-2xl bg-sky-950/60 flex items-center justify-center border border-sky-800/40 text-sky-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rata-Rata Hadir</p>
          <h3 className="text-2xl sm:text-3xl font-black font-heading text-white mt-1">
            {summary?.average_attendance_rate ?? 0}%
          </h3>
          <p className="text-[11px] text-sky-400 font-semibold mt-1 flex items-center gap-1">
            <span>Dari {summary?.total_events ?? 0} Kegiatan</span>
          </p>
        </div>
      </div>

      {/* Segmented UI Tabs (Terpisah agar mudah dibaca) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setSelectedTier('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedTier === 'all'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <span>Semua Anggota</span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-950/40 text-[10px]">
            {summary?.total_members ?? 0}
          </span>
        </button>

        <button
          onClick={() => setSelectedTier('highly_active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedTier === 'highly_active'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-emerald-400/90 hover:text-emerald-300 glass-panel'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Sangat Aktif</span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-950/40 text-[10px]">
            {summary?.highly_active_count ?? 0}
          </span>
        </button>

        <button
          onClick={() => setSelectedTier('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedTier === 'active'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-amber-400/90 hover:text-amber-300 glass-panel'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Cukup Aktif</span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-950/40 text-[10px]">
            {summary?.active_count ?? 0}
          </span>
        </button>

        <button
          onClick={() => setSelectedTier('inactive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedTier === 'inactive'
              ? 'bg-slate-700 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span>Belum / Kurang Aktif</span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-950/40 text-[10px]">
            {summary?.inactive_count ?? 0}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama anggota atau NIM/ID..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[160px]">
            <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              aria-label="Filter Berdasarkan Divisi"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-white focus:outline-none focus:border-sky-500 appearance-none"
            >
              <option value="">Semua Divisi</option>
              {divisions.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Desktop View: Clean Separated Table */}
      <div className="hidden md:block glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4 w-12">No</th>
              <th className="py-3.5 px-4">Nama Anggota & NIM</th>
              <th className="py-3.5 px-4">Divisi</th>
              <th className="py-3.5 px-4 text-center">Status Keaktifan</th>
              <th className="py-3.5 px-4 text-center">Kegiatan Dihadiri</th>
              <th className="py-3.5 px-4">Terakhir Hadir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  {loading ? 'Memuat data keaktifan anggota...' : 'Tidak ada data anggota yang sesuai dengan filter.'}
                </td>
              </tr>
            ) : (
              entries.map((entry, index) => (
                <tr key={entry.member_id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-500 font-semibold">{index + 1}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-white text-sm">{entry.member_name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{entry.member_external_id}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    {entry.member_division ? (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-sky-400 font-semibold text-[11px]">
                        {entry.member_division}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">{getTierBadge(entry.activity_tier)}</td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="font-heading font-black text-white text-sm">
                      {entry.total_events_attended} Kegiatan
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ({entry.total_checkins} total presensi)
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                    {entry.last_attended_at
                      ? new Date(entry.last_attended_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : <span className="text-slate-500 italic">Belum pernah hadir</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile View: High-Performance Readable Cards */}
      <div className="md:hidden space-y-3">
        {entries.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 text-center text-slate-500 text-xs">
            {loading ? 'Memuat data keaktifan anggota...' : 'Tidak ada data anggota yang sesuai dengan filter.'}
          </div>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.member_id}
              className="glass-panel-elevated rounded-2xl p-4 border border-slate-800 shadow-md space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-white">{entry.member_name}</h4>
                    <p className="font-mono text-xs text-slate-400">{entry.member_external_id}</p>
                  </div>
                </div>
                <div>{getTierBadge(entry.activity_tier)}</div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Divisi:</span>
                  <span className="font-semibold text-slate-300">
                    {entry.member_division || 'Umum'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Kehadiran:</span>
                  <span className="font-bold text-sky-400">
                    {entry.total_events_attended} Kegiatan ({entry.attendance_rate}%)
                  </span>
                </div>
              </div>

              {entry.last_attended_at && (
                <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    Terakhir hadir: {new Date(entry.last_attended_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
