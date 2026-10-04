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
  X,
  ChevronRight,
  QrCode,
  Users,
  Copy,
  Check,
} from 'lucide-react';
import { MemberActivityEntry, MemberActivitySummary, ActivityTier } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { DigitalPassCard } from '../components/qr/DigitalPassCard';
import { ModalPortal } from '../components/ui/ModalPortal';

export const MemberTrackerPage: React.FC = () => {
  const [entries, setEntries] = useState<MemberActivityEntry[]>([]);
  const [summary, setSummary] = useState<MemberActivitySummary | null>(null);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedTier, setSelectedTier] = useState<'all' | ActivityTier>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Side Drawer Inspection State
  const [inspectingMember, setInspectingMember] = useState<MemberActivityEntry | null>(null);
  const [passData, setPassData] = useState<{
    tokenString: string;
    memberName: string;
    memberExternalId: string;
    memberDivision?: string | null;
    expiresAt: string;
  } | null>(null);
  const [loadingPass, setLoadingPass] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDivision && selectedDivision !== 'all') {
        params.set('division', selectedDivision);
      }
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
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
  }, [selectedDivision, debouncedSearch, selectedTier]);

  useEffect(() => {
    loadData();

    // Listen for realtime mutation events across tabs and modals
    const handleMutation = () => {
      loadData();
    };

    window.addEventListener('ams:data-mutated', handleMutation);
    return () => {
      window.removeEventListener('ams:data-mutated', handleMutation);
    };
  }, [loadData]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectingMember) {
        setInspectingMember(null);
        setPassData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingMember]);

  const handleOpenInspect = (member: MemberActivityEntry) => {
    setInspectingMember(member);
    setPassData(null);
    setCopiedId(false);
  };

  const handleCloseInspect = () => {
    setInspectingMember(null);
    setPassData(null);
  };

  const handleLoadUniversalQr = async (member: MemberActivityEntry) => {
    try {
      setLoadingPass(true);
      const res = await fetchApi<{
        token: {
          qr_token: string;
          member_name: string;
          member_external_id: string;
          member_division: string | null;
          expires_at: string;
        };
      }>(`/api/members/${member.member_id}/universal-qr`);

      if (res.token) {
        setPassData({
          tokenString: res.token.qr_token,
          memberName: res.token.member_name || member.member_name,
          memberExternalId: res.token.member_external_id || member.member_external_id,
          memberDivision: res.token.member_division || member.member_division,
          expiresAt: res.token.expires_at,
        });
      }
    } catch (err) {
      console.error('Failed to load universal QR pass:', err);
    } finally {
      setLoadingPass(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDivision('');
    setSelectedTier('all');
  };

  const hasActiveFilters = search.trim() !== '' || (selectedDivision !== '' && selectedDivision !== 'all') || selectedTier !== 'all';

  const getTierBadge = (tier: ActivityTier) => {
    switch (tier) {
      case 'highly_active':
        return (
          <Badge variant="emerald" size="xs" dot>
            Sangat Aktif
          </Badge>
        );
      case 'active':
        return (
          <Badge variant="amber" size="xs" dot>
            Cukup Aktif
          </Badge>
        );
      case 'inactive':
      default:
        return (
          <Badge variant="slate" size="xs">
            Belum / Kurang Aktif
          </Badge>
        );
    }
  };

  // Progress Bar Calculations
  const totalMbrs = summary?.total_members || 0;
  const highlyActivePct = totalMbrs > 0 ? ((summary?.highly_active_count || 0) / totalMbrs) * 100 : 0;
  const activePct = totalMbrs > 0 ? ((summary?.active_count || 0) / totalMbrs) * 100 : 0;
  const inactivePct = totalMbrs > 0 ? ((summary?.inactive_count || 0) / totalMbrs) * 100 : 0;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-white flex items-center gap-2.5">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400" />
            <span>Pelacakan Keaktifan Anggota</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pantau tingkat partisipasi dan riwayat presensi anggota pada seluruh kegiatan Computer Community
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          aria-label="Segarkan Data"
          className="self-start sm:self-auto min-h-[40px] px-3.5 py-2 glass-panel text-slate-300 hover:text-white rounded-xl transition-colors flex items-center gap-2 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Enterprise Compact Telemetry Strip (Replaces 4 Giant Slop Cards) */}
      <div className="glass-panel-elevated rounded-2xl p-3.5 sm:p-4 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Telemetry: Overall Attendance Rate & Segmented Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Rata-Rata Kehadiran
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black font-heading text-white">
                  {summary?.average_attendance_rate ?? 0}%
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  ({summary?.total_events ?? 0} Kegiatan)
                </span>
              </div>
            </div>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Distribusi Partisipasi Komunitas</span>
              <span className="text-slate-300 font-semibold">{totalMbrs} Total Anggota</span>
            </div>
            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden flex ring-1 ring-slate-800">
              <div
                style={{ width: `${highlyActivePct}%` }}
                className="bg-emerald-400 transition-colors duration-300"
                title={`Sangat Aktif: ${summary?.highly_active_count ?? 0} (${Math.round(highlyActivePct)}%)`}
              />
              <div
                style={{ width: `${activePct}%` }}
                className="bg-amber-400 transition-colors duration-300"
                title={`Cukup Aktif: ${summary?.active_count ?? 0} (${Math.round(activePct)}%)`}
              />
              <div
                style={{ width: `${inactivePct}%` }}
                className="bg-slate-700 transition-colors duration-300"
                title={`Belum Aktif: ${summary?.inactive_count ?? 0} (${Math.round(inactivePct)}%)`}
              />
            </div>
          </div>
        </div>

        {/* Right Telemetry: Quick Metric Indicators */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap lg:border-l lg:border-slate-800/80 lg:pl-5 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedTier(selectedTier === 'highly_active' ? 'all' : 'highly_active')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
              selectedTier === 'highly_active'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-emerald-500/40 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Sangat Aktif</span>
            <span className="font-mono font-bold text-emerald-400">{summary?.highly_active_count ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTier(selectedTier === 'active' ? 'all' : 'active')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
              selectedTier === 'active'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Cukup Aktif</span>
            <span className="font-mono font-bold text-amber-400">{summary?.active_count ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTier(selectedTier === 'inactive' ? 'all' : 'inactive')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
              selectedTier === 'inactive'
                ? 'bg-slate-800 text-white border-slate-600 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Belum Aktif</span>
            <span className="font-mono font-bold text-slate-400">{summary?.inactive_count ?? 0}</span>
          </button>
        </div>
      </div>

      {/* Unified Command Toolbar (Merged Search & Filter Controls) */}
      <div className="glass-panel p-2.5 sm:p-3 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            aria-label="Cari anggota berdasarkan nama atau NIM/ID"
            placeholder="Cari nama anggota atau NIM/ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none focus:border-sky-500/50 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Hapus teks pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Division Selector */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              aria-label="Filter berdasarkan divisi"
              className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-medium text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">Semua Divisi</option>
              {divisions.map((div) => (
                <option key={div} value={div} className="bg-slate-900">
                  {div}
                </option>
              ))}
            </select>
            <Filter className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Activity Tier Quick Selector */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as 'all' | ActivityTier)}
              aria-label="Filter berdasarkan status keaktifan"
              className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-medium text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Semua Status Keaktifan</option>
              <option value="highly_active" className="bg-slate-900">Sangat Aktif</option>
              <option value="active" className="bg-slate-900">Cukup Aktif</option>
              <option value="inactive" className="bg-slate-900">Belum Aktif</option>
            </select>
            <Filter className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              aria-label="Reset semua filter aktif"
              className="px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:text-white hover:bg-rose-900/60 text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop View: Workstation Table with Row Inspection Click */}
      <div className="hidden md:block glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 w-12 text-center">No</th>
              <th className="py-3 px-4">Nama Anggota & NIM</th>
              <th className="py-3 px-4 whitespace-nowrap">Divisi</th>
              <th className="py-3 px-4 text-center">Status Keaktifan</th>
              <th className="py-3 px-4 text-center">Kegiatan Dihadiri</th>
              <th className="py-3 px-4">Terakhir Hadir</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                    <span>Memuat data keaktifan anggota...</span>
                  </div>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12">
                  <EmptyState
                    icon={<Activity className="w-8 h-8 text-slate-500" />}
                    title="Tidak ada anggota yang sesuai"
                    description={
                      hasActiveFilters
                        ? 'Tidak ada anggota yang cocok dengan filter aktif. Coba ubah kata kunci atau reset filter.'
                        : 'Belum ada data keaktifan anggota yang tercatat pada sistem presensi.'
                    }
                    actionText={hasActiveFilters ? 'Reset Filter' : undefined}
                    onAction={hasActiveFilters ? handleResetFilters : undefined}
                  />
                </td>
              </tr>
            ) : (
              entries.map((entry, index) => {
                const isSelected = inspectingMember?.member_id === entry.member_id;
                return (
                  <tr
                    key={entry.member_id}
                    onClick={() => handleOpenInspect(entry)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-sky-950/40 border-l-2 border-l-sky-400'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 font-semibold">{index + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm group-hover:text-sky-300 transition-colors">
                        {entry.member_name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">{entry.member_external_id}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {entry.member_division ? (
                        <Badge variant="sky" size="xs" icon={<Building2 className="w-3 h-3 text-sky-400 shrink-0" />}>
                          {entry.member_division}
                        </Badge>
                      ) : (
                        <span className="text-slate-500 italic">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">{getTierBadge(entry.activity_tier)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="font-heading font-black text-white text-sm">
                        {entry.total_events_attended} Kegiatan
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {entry.attendance_rate}% kehadiran ({entry.total_checkins} presensi)
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {entry.last_attended_at ? (
                        new Date(entry.last_attended_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      ) : (
                        <span className="text-slate-500 italic">Belum pernah hadir</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInspect(entry);
                        }}
                        aria-label={`Inspeksi detail ${entry.member_name}`}
                        className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-sky-950/50 transition-colors text-xs font-semibold inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <span>Inspeksi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile View: High-Density Clickable Cards */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
            <span>Memuat data keaktifan...</span>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Activity className="w-8 h-8 text-slate-500" />}
            title="Tidak ada anggota yang sesuai"
            description={
              hasActiveFilters
                ? 'Tidak ada anggota yang cocok dengan filter aktif. Coba ubah kata kunci atau reset filter.'
                : 'Belum ada data keaktifan anggota.'
            }
            actionText={hasActiveFilters ? 'Reset Filter' : undefined}
            onAction={hasActiveFilters ? handleResetFilters : undefined}
          />
        ) : (
          entries.map((entry, index) => (
            <button
              key={entry.member_id}
              type="button"
              onClick={() => handleOpenInspect(entry)}
              className="glass-panel-interactive w-full rounded-2xl p-3.5 border border-slate-800 shadow-md space-y-2.5 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-white">{entry.member_name}</h3>
                    <p className="font-mono text-xs text-slate-400">{entry.member_external_id}</p>
                  </div>
                </div>
                <div>{getTierBadge(entry.activity_tier)}</div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Divisi:</span>
                  {entry.member_division ? (
                    <Badge variant="sky" size="xs">
                      {entry.member_division}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold">Umum</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Kehadiran:</span>
                  <span className="font-bold text-sky-400">
                    {entry.total_events_attended} Kegiatan ({entry.attendance_rate}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-mono">
                {entry.last_attended_at ? (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Terakhir: {new Date(entry.last_attended_at).toLocaleDateString('id-ID')}</span>
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Belum pernah hadir</span>
                )}
                <span className="text-sky-400 font-semibold flex items-center gap-0.5 text-xs">
                  <span>Detail</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Interactive Quick Inspect Side Drawer (Sliding Panel) */}
      {inspectingMember && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={handleCloseInspect}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <aside className="w-screen max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col justify-between p-5 sm:p-6 overflow-y-auto z-10">
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500 text-white font-bold font-heading flex items-center justify-center text-base shadow-md shadow-sky-500/20">
                      {inspectingMember.member_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-base text-white">
                        {inspectingMember.member_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-slate-400">
                          {inspectingMember.member_external_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(inspectingMember.member_external_id)}
                          aria-label="Salin NIM/ID"
                          className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
                          title="Salin NIM/ID"
                        >
                          {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseInspect}
                    aria-label="Tutup panel inspeksi"
                    className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getTierBadge(inspectingMember.activity_tier)}
                  {inspectingMember.member_division && (
                    <Badge variant="sky" size="xs">
                      Divisi {inspectingMember.member_division}
                    </Badge>
                  )}
                </div>

                {/* Telemetry Metrics Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-panel p-3 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Rasio Kehadiran
                    </span>
                    <p className="text-xl font-heading font-black text-sky-400">
                      {inspectingMember.attendance_rate}%
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {inspectingMember.total_events_attended} dari {summary?.total_events ?? 0} kegiatan
                    </p>
                  </div>

                  <div className="glass-panel p-3 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Presensi
                    </span>
                    <p className="text-xl font-heading font-black text-white">
                      {inspectingMember.total_checkins}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Check-in & out tercatat
                    </p>
                  </div>
                </div>

                {/* Last Active Timestamp */}
                <div className="glass-panel p-3.5 rounded-xl border border-slate-800/80 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Terakhir Hadir
                    </span>
                    <p className="text-xs font-mono text-slate-200 mt-0.5">
                      {inspectingMember.last_attended_at
                        ? new Date(inspectingMember.last_attended_at).toLocaleString('id-ID', {
                            dateStyle: 'full',
                            timeStyle: 'short',
                          })
                        : 'Belum pernah mengikuti presensi kegiatan'}
                    </p>
                  </div>
                </div>

                {/* Universal QR Pass Section inside Drawer */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-sky-400" />
                      <span>Kartu Pass QR Universal</span>
                    </h4>
                  </div>

                  {passData ? (
                    <div className="space-y-3">
                      <DigitalPassCard
                        tokenString={passData.tokenString}
                        memberName={passData.memberName}
                        memberExternalId={passData.memberExternalId}
                        memberDivision={passData.memberDivision}
                        scope="universal"
                        expiresAt={passData.expiresAt}
                      />
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<QrCode className="w-4 h-4 text-sky-400" />}
                      onClick={() => handleLoadUniversalQr(inspectingMember)}
                      loading={loadingPass}
                      className="w-full justify-center"
                    >
                      Buka Pass QR Anggota
                    </Button>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseInspect}
                  className="w-full justify-center"
                >
                  Tutup Panel
                </Button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
};
