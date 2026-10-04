import React, { useState, useEffect, useCallback } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { Check } from '@phosphor-icons/react/Check';
import { Clock } from '@phosphor-icons/react/Clock';
import { Copy } from '@phosphor-icons/react/Copy';
import { FunnelSimple } from '@phosphor-icons/react/FunnelSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { TrendUp } from '@phosphor-icons/react/TrendUp';
import { UserCheck } from '@phosphor-icons/react/UserCheck';
import { UserMinus } from '@phosphor-icons/react/UserMinus';
import { Users } from '@phosphor-icons/react/Users';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { X } from '@phosphor-icons/react/X';
import {
  MemberActivityEntry,
  MemberActivitySummary,
  ActivityTier,
} from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { cn } from '../lib/cn';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, TBody, TCell, THead, TRow } from '../components/ui/Table';
import { DigitalPassCard } from '../components/qr/DigitalPassCard';
import { ModalPortal } from '../components/ui/ModalPortal';
import { type MarkTone } from '../components/ui/Table';
import { markToneClass } from '../components/ui/Table';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/** Rail hue per activity tier. Each member's rail is derived from their own
 *  tier, so the colour varies across rows and carries real information. */
const tierMark: Record<ActivityTier, MarkTone> = {
  highly_active: 'seal',
  active: 'pending',
  inactive: 'idle',
};

/** The tier word still matters as a label, so it survives — but the rail, not
 *  the badge, is what lets a committee member scan a long list for problems. */
const tierLabel: Record<ActivityTier, string> = {
  highly_active: 'Sangat Aktif',
  active: 'Cukup Aktif',
  inactive: 'Belum / Kurang Aktif',
};

const tierText: Record<ActivityTier, string> = {
  highly_active: 'text-seal-600',
  active: 'text-pending-600',
  inactive: 'text-ink-2',
};

export const MemberTrackerPage: React.FC = () => {
  const [entries, setEntries] = useState<MemberActivityEntry[]>([]);
  const [summary, setSummary] = useState<MemberActivitySummary | null>(null);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // The filter list is unavailable (as opposed to genuinely empty) — the two
  // must never look the same on screen.
  const [divisionsFailed, setDivisionsFailed] = useState<boolean>(false);

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
  const [inspectingMember, setInspectingMember] =
    useState<MemberActivityEntry | null>(null);
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

      // The divisions list is a convenience filter, not the page's subject. A
      // failure there must not abort the load, and must not silently present
      // itself as "this community has no divisions" — so it is settled
      // separately and reported by name.
      const [trackerRes, divRes] = await Promise.allSettled([
        fetchApi<{
          entries: MemberActivityEntry[];
          summary: MemberActivitySummary;
        }>(`/api/attendances/recap/matrix?${params.toString()}`),
        fetchApi<{ divisions: string[] }>('/api/members/divisions'),
      ]);

      if (trackerRes.status === 'rejected') throw trackerRes.reason;

      setEntries(trackerRes.value.entries || []);
      setSummary(trackerRes.value.summary || null);

      if (divRes.status === 'fulfilled') {
        setDivisions(divRes.value.divisions || []);
        setDivisionsFailed(false);
      } else {
        setDivisionsFailed(true);
      }
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
          memberExternalId:
            res.token.member_external_id || member.member_external_id,
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

  const hasActiveFilters =
    search.trim() !== '' ||
    (selectedDivision !== '' && selectedDivision !== 'all') ||
    selectedTier !== 'all';

  // Progress Bar Calculations
  const totalMbrs = summary?.total_members || 0;
  const highlyActivePct =
    totalMbrs > 0 ? ((summary?.highly_active_count || 0) / totalMbrs) * 100 : 0;
  const activePct =
    totalMbrs > 0 ? ((summary?.active_count || 0) / totalMbrs) * 100 : 0;
  const inactivePct =
    totalMbrs > 0 ? ((summary?.inactive_count || 0) / totalMbrs) * 100 : 0;

  return (
    <div className="space-y-5 pb-12 md:space-y-8">
      <PageHeader
        title="Pelacakan Keaktifan Anggota"
        subtitle="Pantau tingkat partisipasi dan riwayat presensi anggota pada seluruh kegiatan Computer Community"
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadData}
            aria-label="Segarkan Data"
            icon={
              <ArrowClockwise
                className={cn('h-4 w-4', loading && 'animate-spin')}
              />
            }
          >
            Segarkan
          </Button>
        }
      />

      {divisionsFailed && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-panel border border-pending-200/70 bg-pending-500/10 p-3 text-xs text-pending-800"
        >
          <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-pending-600" />
          <span>
            Daftar divisi gagal dimuat, filter divisi mungkin tidak lengkap.
            Data keaktifan di bawah tetap valid.
          </span>
        </div>
      )}

      {/* Enterprise Compact Telemetry Strip (Replaces 4 Giant Slop Cards) */}
      <div className="surface flex flex-col justify-between gap-4 rounded-panel p-3.5 sm:p-4 lg:flex-row lg:items-center">
        {/* Left Telemetry: Overall Attendance Rate & Segmented Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-panel border border-pen-200/70 bg-pen-50/70 text-ink-2">
              <TrendUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-ink-2 uppercase tracking-wider block">
                Rata-Rata Kehadiran
              </span>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-oxanium text-2xl font-extrabold text-ink">
                  {summary?.average_attendance_rate ?? 0}%
                </span>
                <span className="text-[11px] text-ink-2 font-medium">
                  ({summary?.total_events ?? 0} Kegiatan)
                </span>
              </div>
            </div>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between font-oxanium text-[11px] text-ink-2">
              <span>Distribusi Partisipasi Komunitas</span>
              <span className="text-ink font-semibold">
                {totalMbrs} Total Anggota
              </span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-chip bg-ink ring-1 ring-rule">
              <div
                style={{ width: `${highlyActivePct}%` }}
                className="bg-seal-500 transition-colors duration-120"
                title={`Sangat Aktif: ${summary?.highly_active_count ?? 0} (${Math.round(highlyActivePct)}%)`}
              />
              <div
                style={{ width: `${activePct}%` }}
                className="bg-pending-500 transition-colors duration-120"
                title={`Cukup Aktif: ${summary?.active_count ?? 0} (${Math.round(activePct)}%)`}
              />
              <div
                style={{ width: `${inactivePct}%` }}
                className="bg-ink-3 transition-colors duration-120"
                title={`Belum Aktif: ${summary?.inactive_count ?? 0} (${Math.round(inactivePct)}%)`}
              />
            </div>
          </div>
        </div>

        {/* Right Telemetry: Quick Metric Indicators */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3 lg:border-l lg:border-rule lg:pl-5">
          <button
            type="button"
            onClick={() =>
              setSelectedTier(
                selectedTier === 'highly_active' ? 'all' : 'highly_active',
              )
            }
            className={`px-3 py-1.5 rounded-panel border text-xs font-semibold flex items-center gap-2 transition-colors ${
              selectedTier === 'highly_active'
                ? 'bg-seal-50 text-seal-800 border-seal-200 shadow-sm'
                : 'bg-paper-sunk/60 text-ink border-rule-strong hover:border-seal-200/70 hover:text-ink'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-seal-500" />
            <span>Sangat Aktif</span>
            <span className="font-oxanium font-bold text-seal-600">
              {summary?.highly_active_count ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedTier(selectedTier === 'active' ? 'all' : 'active')
            }
            className={`px-3 py-1.5 rounded-panel border text-xs font-semibold flex items-center gap-2 transition-colors ${
              selectedTier === 'active'
                ? 'bg-pending-50 text-pending-800 border-pending-200 shadow-sm'
                : 'bg-paper-sunk/60 text-ink border-rule-strong hover:border-pending-200/70 hover:text-ink'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-pending-500" />
            <span>Cukup Aktif</span>
            <span className="font-oxanium font-bold text-pending-600">
              {summary?.active_count ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedTier(selectedTier === 'inactive' ? 'all' : 'inactive')
            }
            className={`px-3 py-1.5 rounded-panel border text-xs font-semibold flex items-center gap-2 transition-colors ${
              selectedTier === 'inactive'
                ? 'bg-rule-strong text-ink border-rule-strong shadow-sm'
                : 'bg-paper-sunk/60 text-ink-2 border-rule-strong hover:border-rule-strong hover:text-ink'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-ink-2" />
            <span>Belum Aktif</span>
            <span className="font-oxanium font-bold text-ink-2">
              {summary?.inactive_count ?? 0}
            </span>
          </button>
        </div>
      </div>

      {/* Unified Command Toolbar (Merged Search & Filter Controls) */}
      <div className="surface flex flex-col items-stretch justify-between gap-2.5 rounded-panel p-2.5 sm:p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
          <input
            type="text"
            aria-label="Cari anggota berdasarkan nama atau NIM/ID"
            placeholder="Cari nama anggota atau NIM/ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'min-h-[44px] w-full rounded-chip border border-rule-strong bg-ink py-2 pl-9 pr-8 text-xs text-paper placeholder-ink-3 transition-colors duration-120 hover:border-rule-strong focus:border-pen-200',
              focusRing,
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Hapus teks pencarian"
              className={cn(
                'touch-target absolute right-0.5 top-1/2 -translate-y-1/2 rounded-chip text-ink-2 transition-colors duration-120 hover:text-ink',
                focusRing,
              )}
            >
              <X className="mx-auto h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Division Selector */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <Buildings className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2" />
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              aria-label="Filter berdasarkan divisi"
              className={cn(
                'min-h-[44px] w-full cursor-pointer appearance-none rounded-chip border border-rule-strong bg-ink py-2 pl-8 pr-7 text-xs font-medium text-paper transition-colors duration-120 hover:border-rule-strong',
                focusRing,
              )}
            >
              <option value="" className="bg-paper-sunk">
                Semua Divisi
              </option>
              {divisions.map((div) => (
                <option key={div} value={div} className="bg-paper-sunk">
                  {div}
                </option>
              ))}
            </select>
            <FunnelSimple className="w-3 h-3 text-ink-2 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Activity Tier Quick Selector */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <select
              value={selectedTier}
              onChange={(e) =>
                setSelectedTier(e.target.value as 'all' | ActivityTier)
              }
              aria-label="Filter berdasarkan status keaktifan"
              className={cn(
                'min-h-[44px] w-full cursor-pointer appearance-none rounded-chip border border-rule-strong bg-ink px-3 py-2 text-xs font-medium text-paper transition-colors duration-120 hover:border-rule-strong',
                focusRing,
              )}
            >
              <option value="all" className="bg-paper-sunk">
                Semua Status Keaktifan
              </option>
              <option value="highly_active" className="bg-paper-sunk">
                Sangat Aktif
              </option>
              <option value="active" className="bg-paper-sunk">
                Cukup Aktif
              </option>
              <option value="inactive" className="bg-paper-sunk">
                Belum Aktif
              </option>
            </select>
            <FunnelSimple className="w-3 h-3 text-ink-2 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              aria-label="Reset semua filter aktif"
              className="px-3 py-2 rounded-panel bg-pen-50/70 border border-pen-200 text-pen-deep hover:text-ink hover:bg-pen-50/70 text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <X className="mx-auto h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop View: Workstation Table with Row Inspection Click */}
      <div className="surface hidden overflow-hidden rounded-panel md:block">
        <Table>
          <THead>
            <TCell header className="w-12 text-center">
              No
            </TCell>
            <TCell header>Nama Anggota &amp; NIM</TCell>
            <TCell header className="whitespace-nowrap">
              Divisi
            </TCell>
            <TCell header className="text-center">
              Status Keaktifan
            </TCell>
            <TCell header className="text-center">
              Kegiatan Dihadiri
            </TCell>
            <TCell header>Terakhir Hadir</TCell>
            <TCell header className="text-right">
              Aksi
            </TCell>
          </THead>
          <TBody>
            {loading ? (
              <TRow>
                <TCell colSpan={7} className="py-12 text-center text-ink-2">
                  <span className="flex items-center justify-center gap-2">
                    <ArrowClockwise className="h-4 w-4 animate-spin text-ink-2" />
                    <span>Memuat data keaktifan anggota...</span>
                  </span>
                </TCell>
              </TRow>
            ) : entries.length === 0 ? (
              <TRow>
                <TCell colSpan={7} className="py-12">
                  <EmptyState
                    icon={<ChartLineUp className="h-8 w-8 text-ink-2" />}
                    title="Tidak ada anggota yang sesuai"
                    description={
                      hasActiveFilters
                        ? 'Tidak ada anggota yang cocok dengan filter aktif. Coba ubah kata kunci atau reset filter.'
                        : 'Belum ada data keaktifan anggota yang tercatat pada sistem presensi.'
                    }
                    actionText={hasActiveFilters ? 'Reset Filter' : undefined}
                    onAction={hasActiveFilters ? handleResetFilters : undefined}
                  />
                </TCell>
              </TRow>
            ) : (
              entries.map((entry, index) => (
                <TRow
                  key={entry.member_id}
                  onClick={() => handleOpenInspect(entry)}
                  selected={inspectingMember?.member_id === entry.member_id}
                  mark={tierMark[entry.activity_tier]}
                  className="group cursor-pointer"
                >
                  <TCell className="text-center font-oxanium font-semibold text-ink-2">
                    {index + 1}
                  </TCell>
                  <TCell>
                    <div className="truncate text-sm font-bold text-ink">
                      {entry.member_name}
                    </div>
                    <div className="truncate font-oxanium text-[11px] text-ink-2">
                      {entry.member_external_id}
                    </div>
                  </TCell>
                  <TCell className="whitespace-nowrap">
                    {entry.member_division ? (
                      <Badge variant="pen" size="xs">
                        {entry.member_division}
                      </Badge>
                    ) : (
                      <span className="italic text-ink-2">-</span>
                    )}
                  </TCell>
                  <TCell
                    className={cn(
                      'text-center font-semibold',
                      tierText[entry.activity_tier],
                    )}
                  >
                    {tierLabel[entry.activity_tier]}
                  </TCell>
                  <TCell className="text-center">
                    <div className="font-oxanium text-sm font-bold text-ink">
                      {entry.total_events_attended} Kegiatan
                    </div>
                    <div className="font-oxanium text-[10px] text-ink-2">
                      {entry.attendance_rate}% kehadiran ({entry.total_checkins}{' '}
                      presensi)
                    </div>
                  </TCell>
                  <TCell className="font-oxanium text-[11px] text-ink-2">
                    {entry.last_attended_at ? (
                      <span className="truncate">
                        {new Date(entry.last_attended_at).toLocaleString(
                          'id-ID',
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          },
                        )}
                      </span>
                    ) : (
                      <span className="italic text-ink-2">
                        Belum pernah hadir
                      </span>
                    )}
                  </TCell>
                  <TCell className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenInspect(entry);
                      }}
                      aria-label={`Inspeksi detail ${entry.member_name}`}
                      className={cn(
                        'inline-flex min-h-[44px] items-center gap-1 rounded-chip px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors duration-120 hover:bg-pen-50/70 hover:text-ink-2',
                        focusRing,
                      )}
                    >
                      <span>Inspeksi</span>
                      <CaretRight className="h-3.5 w-3.5" />
                    </button>
                  </TCell>
                </TRow>
              ))
            )}
          </TBody>
        </Table>
      </div>

      {/* Mobile View: High-Density Clickable Cards */}
      <div className="space-y-2.5 md:hidden">
        {loading ? (
          <div className="surface flex items-center justify-center gap-2 rounded-panel p-8 text-center text-xs text-ink-2">
            <ArrowClockwise className="h-4 w-4 animate-spin text-ink-2" />
            <span>Memuat data keaktifan...</span>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<ChartLineUp className="h-8 w-8 text-ink-2" />}
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
            // The rail replaces the tier badge here: on a phone the officer is
            // scanning a long list for disengaged members, and a colour column
            // reads faster than a word repeated on every card.
            <button
              key={entry.member_id}
              type="button"
              onClick={() => handleOpenInspect(entry)}
              className={cn(
                'flex w-full cursor-pointer flex-col gap-2.5 rounded-panel border border-l-2 border-rule bg-paper p-3.5 text-left transition-colors duration-120 hover:bg-paper-raised',
                markToneClass[tierMark[entry.activity_tier]],
                focusRing,
                'focus-visible:ring-offset-0',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip border border-rule bg-ink font-oxanium text-[11px] font-bold text-ink-2">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-sm font-bold text-ink">
                      {entry.member_name}
                    </span>
                    <span className="block truncate font-oxanium text-[10px] text-ink-2">
                      {entry.member_external_id}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[10px] font-bold uppercase tracking-wider',
                    tierText[entry.activity_tier],
                  )}
                >
                  {tierLabel[entry.activity_tier]}
                </span>
              </span>

              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-ink-2">
                    Divisi:
                  </span>
                  {entry.member_division ? (
                    <Badge variant="pen" size="xs">
                      {entry.member_division}
                    </Badge>
                  ) : (
                    <span className="text-xs font-semibold text-ink-2">
                      Umum
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-ink-2">
                    Kehadiran:
                  </span>
                  <span className="font-oxanium text-xs font-bold text-ink-2">
                    {entry.total_events_attended} Kegiatan (
                    {entry.attendance_rate}%)
                  </span>
                </span>
              </span>

              <span className="flex items-center justify-between gap-2 border-t border-rule pt-2 font-oxanium text-[11px] text-ink-2">
                {entry.last_attended_at ? (
                  <span className="flex min-w-0 items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0 text-ink-2" />
                    <span className="truncate">
                      Terakhir:{' '}
                      {new Date(entry.last_attended_at).toLocaleDateString(
                        'id-ID',
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="italic text-ink-2">
                    Belum pernah hadir
                  </span>
                )}
                <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-ink-2">
                  <span>Detail</span>
                  <CaretRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          ))
        )}
      </div>

      {/* Interactive Quick Inspect Side Drawer (Sliding Panel) */}
      {inspectingMember && (
        <div className="fixed inset-0 z-modal overflow-hidden">
          {/* Backdrop Overlay */}
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={handleCloseInspect}
          />

          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <aside
              role="dialog"
              aria-modal="true"
              aria-label={`Detail ${inspectingMember.member_name}`}
              className="surface z-bar flex w-screen max-w-md flex-col justify-between overflow-y-auto border-l p-5 shadow-ambient sm:p-6"
            >
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-rule-strong">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-panel border border-pen-200/70 bg-pen-50/70 font-heading text-base font-bold text-ink-2">
                      {inspectingMember.member_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-base text-ink">
                        {inspectingMember.member_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-oxanium text-xs text-ink-2">
                          {inspectingMember.member_external_id}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyId(inspectingMember.member_external_id)
                          }
                          aria-label="Salin NIM/ID"
                          className="text-ink-2 hover:text-ink p-0.5 rounded"
                          title="Salin NIM/ID"
                        >
                          {copiedId ? (
                            <Check className="w-3 h-3 text-seal-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseInspect}
                    aria-label="Tutup panel inspeksi"
                    className="w-8 h-8 rounded-chip bg-paper-sunk border border-rule-strong text-ink-2 hover:text-ink flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* In the single-member drawer the tier *word* is the point
                      of the panel, so it stays a badge. */}
                  <Badge
                    variant={
                      inspectingMember.activity_tier === 'highly_active'
                        ? 'seal'
                        : inspectingMember.activity_tier === 'active'
                          ? 'pending'
                          : 'neutral'
                    }
                    size="xs"
                    dot
                  >
                    {tierLabel[inspectingMember.activity_tier]}
                  </Badge>
                  {inspectingMember.member_division && (
                    <Badge variant="pen" size="xs">
                      Divisi {inspectingMember.member_division}
                    </Badge>
                  )}
                </div>

                {/* Telemetry Metrics Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="surface-raised space-y-1 rounded-chip p-3">
                    <span className="text-[10px] font-bold text-ink-2 uppercase tracking-wider block">
                      Rasio Kehadiran
                    </span>
                    <p className="font-oxanium text-xl font-extrabold text-ink-2">
                      {inspectingMember.attendance_rate}%
                    </p>
                    <p className="text-[10px] text-ink-2">
                      {inspectingMember.total_events_attended} dari{' '}
                      {summary?.total_events ?? 0} kegiatan
                    </p>
                  </div>

                  <div className="surface-raised space-y-1 rounded-chip p-3">
                    <span className="text-[10px] font-bold text-ink-2 uppercase tracking-wider block">
                      Total Presensi
                    </span>
                    <p className="text-xl font-heading font-black text-ink">
                      {inspectingMember.total_checkins}
                    </p>
                    <p className="text-[10px] text-ink-2">
                      Check-in & out tercatat
                    </p>
                  </div>
                </div>

                {/* Last Active Timestamp */}
                <div className="surface-raised flex items-center gap-3 rounded-chip p-3.5">
                  <div className="w-8 h-8 rounded-chip bg-paper-sunk flex items-center justify-center text-ink-2 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-ink-2 uppercase tracking-wider block">
                      Terakhir Hadir
                    </span>
                    <p className="text-xs font-oxanium text-ink mt-0.5">
                      {inspectingMember.last_attended_at
                        ? new Date(
                            inspectingMember.last_attended_at,
                          ).toLocaleString('id-ID', {
                            dateStyle: 'full',
                            timeStyle: 'short',
                          })
                        : 'Belum pernah mengikuti presensi kegiatan'}
                    </p>
                  </div>
                </div>

                {/* Universal QR Pass Section inside Drawer */}
                <div className="space-y-3 pt-2 border-t border-rule">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-ink">
                      <QrCode className="h-3.5 w-3.5 text-ink-2" />
                      <span>Kartu Pass QR Universal</span>
                    </h3>
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
                      icon={<QrCode className="h-4 w-4 text-ink-2" />}
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
              <div className="pt-4 border-t border-rule-strong">
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
