import React, { useState, useEffect, useCallback } from 'react';
import { Archive } from '@phosphor-icons/react/Archive';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise';
import { Broom } from '@phosphor-icons/react/Broom';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { Eye } from '@phosphor-icons/react/Eye';
import { FunnelSimple } from '@phosphor-icons/react/FunnelSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { Printer } from '@phosphor-icons/react/Printer';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { Trash } from '@phosphor-icons/react/Trash';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { UserCheck } from '@phosphor-icons/react/UserCheck';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Users } from '@phosphor-icons/react/Users';
import { PartialBanner } from '../ui/PartialBanner';
import { X } from '@phosphor-icons/react/X';
import { Member, MemberStatsSummary } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';
import { fetchCached, invalidateCache } from '../../lib/swr-client';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Stat } from '../ui/Stat';
import { Tabs } from '../ui/Tabs';
import { EmptyState } from '../ui/EmptyState';
import { RowList, type RowListItem } from '../ui/RowList';
import { BulkActionBar, BulkActionItem } from '../ui/BulkActionBar';
import { RowActions, type RowActionItem } from '../ui/RowActions';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AlertModal } from '../ui/AlertModal';
import { CandidateInductionModal } from './CandidateInductionModal';
import { ConvertGuestModal, ConvertGuestItem } from './ConvertGuestModal';
import { ModalPortal } from '../ui/ModalPortal';
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const iconButtonClass = (tone: 'pen' | 'neutral' | 'danger' | 'warning' | 'primary') =>
  cn(
    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-chip transition-colors duration-120 ease-out-expo',
    focusRing,
    tone === 'pen' && 'text-pen-600 hover:bg-pen-50/70',
    tone === 'neutral' && 'text-ink-2 hover:bg-paper-sunk hover:text-ink',
    tone === 'danger' && 'text-ink-2 hover:bg-pending-50 hover:text-pending-700',
    tone === 'warning' && 'text-pending-700 hover:bg-pending-50 hover:text-pending-900',
    tone === 'primary' && 'text-pen-600 hover:bg-pen-50/70 hover:text-pen-deep font-bold'
  );

export interface CandidateWorkspaceProps {
  canManage: boolean;
  canExport: boolean;
  canGenerate: boolean;
  divisions: string[];
  groups: string[];
  onViewPass: (member: Member) => void;
  onBulkPrint: (members: Member[]) => void;
  onOpenAddCandidate: () => void;
  onOpenImportCandidate: () => void;
  onEditCandidate: (member: Member) => void;
  onRefreshGlobal?: () => void;
}

export const CandidateWorkspace: React.FC<CandidateWorkspaceProps> = ({
  canManage,
  canExport,
  canGenerate,
  divisions,
  groups,
  onViewPass,
  onBulkPrint,
  onOpenAddCandidate,
  onOpenImportCandidate,
  onEditCandidate,
  onRefreshGlobal,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [candidates, setCandidates] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<MemberStatsSummary>({
    total: 0,
    active: 0,
    inactive: 0,
    candidate: 0,
    archived: 0,
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState<boolean>(false);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [failedSections, setFailedSections] = useState<string[]>([]);

  const availableGroups = Array.from(
    new Set(
      [
        ...groups,
        ...candidates
          .map((c) => c.group_name)
          .filter((g): g is string => Boolean(g && g.trim() !== '')),
      ].sort()
    )
  );
  // Modals & Dialogs
  const [isInductionOpen, setIsInductionOpen] = useState<boolean>(false);
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState<boolean>(false);
  const [availableGuests, setAvailableGuests] = useState<Member[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [guestSearch, setGuestSearch] = useState<string>('');
  const [guestLoading, setGuestLoading] = useState<boolean>(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState<boolean>(false);

  const [inductingCandidates, setInductingCandidates] = useState<Member[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    type?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: null,
    onConfirm: async () => {},
  });
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const handleOpenGuestPicker = async () => {
    setIsGuestPickerOpen(true);
    setSelectedGuestIds(new Set());
    setGuestSearch('');
    setGuestLoading(true);
    try {
      const res = await fetchApi<{ members: Member[] }>('/api/members?include_temporary=true&limit=200');
      if (res && Array.isArray(res.members)) {
        const guests = res.members.filter(
          (m: Member) =>
            m.external_id?.startsWith('GUEST-') ||
            (m.group_name && m.group_name.startsWith('Tamu:')) ||
            (typeof m.metadata === 'object' && m.metadata && (m.metadata as Record<string, unknown>).temporary === true) ||
            (typeof m.metadata === 'string' && m.metadata.includes('"temporary":true'))
        );
        setAvailableGuests(guests);
      }
    } catch (err: unknown) {
      console.error('Failed to load guest attendees:', err);
    } finally {
      setGuestLoading(false);
    }
  };

  const handleToggleGuestSelect = (id: string) => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredGuests = availableGuests.filter((g) => {
    if (!guestSearch.trim()) return true;
    const q = guestSearch.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.external_id.toLowerCase().includes(q) ||
      (g.division && g.division.toLowerCase().includes(q))
    );
  });

  const handleSelectAllGuests = () => {
    if (selectedGuestIds.size === filteredGuests.length) {
      setSelectedGuestIds(new Set());
    } else {
      setSelectedGuestIds(new Set(filteredGuests.map((g) => g.id)));
    }
  };

  const guestsToConvert: ConvertGuestItem[] = availableGuests
    .filter((g) => selectedGuestIds.has(g.id))
    .map((g) => ({
      id: g.id,
      name: g.name,
      external_id: g.external_id,
      division: g.division,
      group_name: g.group_name,
    }));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadStats = useCallback(async (opts?: { forceRefresh?: boolean }) => {
    try {
      const summary = await fetchCached<MemberStatsSummary>('/api/members/stats/summary', {
        forceRefresh: opts?.forceRefresh,
        ttlMs: 5_000,
      });
      setStats(summary);
    } catch (err) {
      console.error('Failed to load candidate stats summary:', err);
    }
  }, []);

  const loadCandidates = useCallback(
    async (opts?: { forceRefresh?: boolean }) => {
      setLoading(true);
      setFailedSections((prev) => prev.filter((s) => s !== 'calon'));
      try {
        const params = new URLSearchParams();
        params.set('status', activeTab === 'active' ? 'candidate' : 'archived');
        params.set('limit', '200');
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (activeTab === 'archived' && selectedGroup) params.set('group_name', selectedGroup);

        const res = await fetchCached<{ members: Member[]; total: number }>(
          `/api/members?${params.toString()}`,
          {
            forceRefresh: opts?.forceRefresh,
            ttlMs: 5_000,
          }
        );
        setCandidates(res.members || []);
      } catch (err) {
        console.error('Failed to load candidates:', err);
        setFailedSections((prev) => [...prev.filter((s) => s !== 'calon'), 'calon']);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, debouncedSearch, selectedGroup]
  );

  useEffect(() => {
    loadStats();
    loadCandidates();

    const handleMutation = () => {
      loadStats({ forceRefresh: true });
      loadCandidates({ forceRefresh: true });
    };

    window.addEventListener('ams:data-mutated', handleMutation);
    return () => {
      window.removeEventListener('ams:data-mutated', handleMutation);
    };
  }, [loadStats, loadCandidates]);

  // Selections
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Single candidate actions
  const handleSingleInduct = (member: Member) => {
    setInductingCandidates([member]);
    setIsInductionOpen(true);
  };

  const handleSingleArchive = (member: Member) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Arsipkan Calon Anggota',
      message: (
        <span>
          Pindahkan <strong>{member.name}</strong> ({member.external_id}) ke Arsip Calon?
        </span>
      ),
      type: 'warning',
      confirmText: 'Ya, Arsipkan',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/members/candidates/archive', {
            method: 'POST',
            body: JSON.stringify({ member_ids: [member.id] }),
          });
          invalidateCache('/api/members');
          window.dispatchEvent(new CustomEvent('ams:data-mutated'));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadCandidates({ forceRefresh: true });
          await loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err: unknown) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Mengarsipkan Calon',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleSingleRestore = (member: Member) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Pulihkan ke Calon Aktif',
      message: (
        <span>
          Pulihkan status <strong>{member.name}</strong> ({member.external_id}) kembali menjadi Calon Aktif?
        </span>
      ),
      type: 'info',
      confirmText: 'Ya, Pulihkan',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/members/candidates/restore', {
            method: 'POST',
            body: JSON.stringify({ member_ids: [member.id] }),
          });
          invalidateCache('/api/members');
          window.dispatchEvent(new CustomEvent('ams:data-mutated'));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadCandidates({ forceRefresh: true });
          await loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err: unknown) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Memulihkan Calon',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleSingleDelete = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Data Calon',
      message: (
        <span>
          Apakah Anda yakin ingin menghapus data <strong>{name}</strong> secara permanen?
        </span>
      ),
      type: 'danger',
      confirmText: 'Hapus Permanen',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi(`/api/members/${id}`, { method: 'DELETE' });
          invalidateCache('/api/members');
          window.dispatchEvent(new CustomEvent('ams:data-mutated'));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadCandidates({ forceRefresh: true });
          await loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err: unknown) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Calon',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  // Bulk actions
  const handleBulkInduct = () => {
    const selected = candidates.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    setInductingCandidates(selected);
    setIsInductionOpen(true);
  };

  const handleBulkArchiveSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Arsipkan ${ids.length} Calon Terpilih`,
      message: (
        <span>
          Pindahkan <strong>{ids.length} calon anggota</strong> terpilih ke Arsip Calon?
        </span>
      ),
      type: 'warning',
      confirmText: 'Ya, Arsipkan',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/members/candidates/archive', {
            method: 'POST',
            body: JSON.stringify({ member_ids: ids }),
          });
          invalidateCache('/api/members');
          window.dispatchEvent(new CustomEvent('ams:data-mutated'));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedIds(new Set());
          await loadCandidates({ forceRefresh: true });
          await loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err: unknown) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Mengarsipkan Calon',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleBulkRestoreSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Pulihkan ${ids.length} Calon Terpilih`,
      message: (
        <span>
          Pulihkan <strong>{ids.length} calon anggota</strong> terpilih kembali menjadi Calon Aktif?
        </span>
      ),
      type: 'info',
      confirmText: 'Ya, Pulihkan',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/members/candidates/restore', {
            method: 'POST',
            body: JSON.stringify({ member_ids: ids }),
          });
          invalidateCache('/api/members');
          window.dispatchEvent(new CustomEvent('ams:data-mutated'));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedIds(new Set());
          await loadCandidates({ forceRefresh: true });
          await loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err: unknown) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Memulihkan Calon',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleBulkDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Hapus Permanen ${ids.length} Anggota`,
      message: (
        <span>
          Apakah Anda yakin ingin menghapus permanen <strong>{ids.length} data</strong> yang dipilih? Tindakan ini tidak dapat dibatalkan.
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Hapus Permanen',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          if (activeTab === 'archived') {
            await fetchApi('/api/members/candidates/purge', {
              method: 'POST',
              body: JSON.stringify({ member_ids: ids }),
            });
          } else {
            await fetchApi('/api/members/bulk-delete', {
              method: 'POST',
              body: JSON.stringify({ ids }),
            });
          }
          invalidateCache('/api/members');
          window.dispatchEvent(new CustomEvent('ams:data-mutated'));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedIds(new Set());
          await loadCandidates({ forceRefresh: true });
          await loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err: unknown) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Data',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handlePurgeAllArchived = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Bersihkan Seluruh Arsip Calon',
      message: (
        <span>
          Apakah Anda yakin ingin <strong>menghapus permanen seluruh data ({stats.archived}) calon anggota diarsipkan</strong>? Riwayat presensi terkait calon ini juga akan dibersihkan. Tindakan ini permanen.
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Bersihkan Seluruh Arsip',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/members/candidates/purge', {
            method: 'POST',
            body: JSON.stringify({ all_archived: true }),
          });
          invalidateCache('/api/members');
          window.dispatchEvent(new CustomEvent('ams:data-mutated'));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedIds(new Set());
          await loadCandidates({ forceRefresh: true });
          await loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err: unknown) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Membersihkan Arsip',
            message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handlePrintSelected = () => {
    const selected = candidates.filter((c) => selectedIds.has(c.id));
    if (selected.length > 0) {
      onBulkPrint(selected);
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (activeTab === 'archived' && selectedGroup) params.set('group_name', selectedGroup);
    params.set('status', activeTab === 'active' ? 'candidate' : 'archived');
    params.set('format', 'csv');

    window.open(`/api/members/export?${params.toString()}`, '_blank');
  };

  const bulkActions: BulkActionItem[] =
    activeTab === 'active'
      ? [
          ...(canManage
            ? [
                {
                  label: 'Lantik Terpilih',
                  icon: <UserCheck className="w-3.5 h-3.5" />,
                  variant: 'primary' as const,
                  onClick: handleBulkInduct,
                  loading: bulkActionLoading,
                },
                {
                  label: 'Arsipkan',
                  icon: <Archive className="w-3.5 h-3.5" />,
                  variant: 'warning' as const,
                  onClick: handleBulkArchiveSelected,
                },
              ]
            : []),
          ...(canGenerate
            ? [
                {
                  label: 'Cetak QR',
                  icon: <Printer className="w-3.5 h-3.5" />,
                  variant: 'default' as const,
                  onClick: handlePrintSelected,
                },
              ]
            : []),
          ...(canManage
            ? [
                {
                  label: 'Hapus',
                  icon: <Trash className="w-3.5 h-3.5" />,
                  variant: 'danger' as const,
                  onClick: handleBulkDeleteSelected,
                },
              ]
            : []),
        ]
      : [
          ...(canManage
            ? [
                {
                  label: 'Pulihkan ke Calon',
                  icon: <ArrowCounterClockwise className="w-3.5 h-3.5" />,
                  variant: 'primary' as const,
                  onClick: handleBulkRestoreSelected,
                },
                {
                  label: 'Hapus Permanen',
                  icon: <Trash className="w-3.5 h-3.5" />,
                  variant: 'danger' as const,
                  onClick: handleBulkDeleteSelected,
                },
              ]
            : []),
        ];

  const candidateRows: RowListItem[] = candidates.map((c) => {
    const contact = [c.email, c.phone].filter(Boolean).join(' · ');
    const meta = [c.external_id, c.group_name ? `Angkatan: ${c.group_name}` : null, c.division, contact]
      .filter(Boolean)
      .join('  ·  ');

    // Same actions and the same announced labels as the inline buttons; the
    // kebab is how a 344px row reaches them.
    const menuItems: RowActionItem[] = [];
    if (activeTab === 'active' && canManage) {
      menuItems.push({
        label: `Lantik`,
        icon: <UserCheck className="h-4 w-4" />,
        onSelect: () => handleSingleInduct(c),
      });
    }
    if (activeTab === 'archived' && canManage) {
      menuItems.push({
        label: `Pulihkan`,
        icon: <ArrowCounterClockwise className="h-4 w-4" />,
        onSelect: () => handleSingleRestore(c),
      });
    }
    menuItems.push({
      label: `Lihat Pass QR`,
      icon: <Eye className="h-4 w-4" />,
      onSelect: () => onViewPass(c),
    });
    if (canManage) {
      menuItems.push({
        label: `Edit`,
        icon: <PencilSimple className="h-4 w-4" />,
        onSelect: () => onEditCandidate(c),
      });
      if (activeTab === 'active') {
        menuItems.push({
          label: `Arsipkan`,
          icon: <Archive className="h-4 w-4" />,
          onSelect: () => handleSingleArchive(c),
        });
      }
      menuItems.push({
        label: `Hapus`,
        icon: <Trash className="h-4 w-4" />,
        onSelect: () => handleSingleDelete(c.id, c.name),
        tone: 'danger',
      });
    }

    return {
      id: c.id,
      title: c.name,
      meta: meta || undefined,
      status: {
        label: activeTab === 'active' ? 'Calon Anggota' : 'Diarsipkan',
        tone: activeTab === 'active' ? ('pending' as const) : ('idle' as const),
      },
      action: (
        <span className="flex items-center gap-1">
          {/* Desktop keeps the inline cluster; below `sm` the same actions live
              in the kebab, because six 44px targets do not fit a 344px row. */}
          <span className="hidden items-center gap-1 sm:flex">
            {activeTab === 'active' && canManage && (
              <button
                type="button"
                onClick={() => handleSingleInduct(c)}
                title="Lantik menjadi Anggota Aktif"
                aria-label={`Lantik`}
                className={iconButtonClass('primary')}
              >
                <UserCheck className="w-4 h-4 text-pen-deep" />
              </button>
            )}

            {activeTab === 'archived' && canManage && (
              <button
                type="button"
                onClick={() => handleSingleRestore(c)}
                title="Pulihkan ke Calon Aktif"
                aria-label={`Pulihkan`}
                className={iconButtonClass('primary')}
              >
                <ArrowCounterClockwise className="w-4 h-4 text-pen-deep" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onViewPass(c)}
              title="Lihat Pass QR Calon"
              aria-label={`Lihat Pass QR`}
              className={iconButtonClass('pen')}
            >
              <Eye className="w-4 h-4" />
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onEditCandidate(c)}
                  title="Edit Data Calon"
                  aria-label={`Edit`}
                  className={iconButtonClass('neutral')}
                >
                  <PencilSimple className="w-4 h-4" />
                </button>

                {activeTab === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleSingleArchive(c)}
                    title="Pindahkan ke Arsip"
                    aria-label={`Arsipkan`}
                    className={iconButtonClass('warning')}
                  >
                    <Archive className="w-4 h-4 text-pending-700" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleSingleDelete(c.id, c.name)}
                  title="Hapus Data"
                  aria-label={`Hapus`}
                  className={iconButtonClass('danger')}
                >
                  <Trash className="w-4 h-4" />
                </button>
              </>
            )}
          </span>
          <RowActions className="sm:hidden" label={`Menu aksi`} items={menuItems} />
        </span>
      ),
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Honest partial-failure notice */}
      <PartialBanner sections={failedSections} />

      {/* Candidate Summary Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Total Calon"
          value={stats.candidate + stats.archived}
          hint="Seluruh calon terdaftar dalam sistem"
          icon={<Users className="w-4 h-4" />}
        />
        <Stat
          label="Calon Aktif"
          value={stats.candidate}
          hint="Mengikuti kegiatan & siap dilantik"
          // mark="pending"
        />
        <Stat
          label="Calon Diarsipkan"
          value={stats.archived}
          hint="Diparkir / tidak terpilih pelantikan"
          // mark="idle"
          icon={<Archive className="w-4 h-4" />}
        />
      </div>

      {/* Sub-Tabs & Main Action Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          items={[
            { id: 'active', label: 'Calon Aktif' },
            { id: 'archived', label: 'Arsip Calon' },
          ]}
          active={activeTab}
          onChange={(tabId) => {
            setActiveTab(tabId as 'active' | 'archived');
            setSelectedIds(new Set());
            setSelectedGroup('');
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'active' && canManage && (
            <Button
              variant="secondary"
              size="sm"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={handleOpenGuestPicker}
              title="Pindahkan peserta tamu kegiatan menjadi calon anggota"
            >
              Pindahkan dari Tamu
            </Button>
          )}

          {activeTab === 'active' && canManage && selectedIds.size > 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={<UserCheck className="w-4 h-4" />}
              onClick={handleBulkInduct}
            >
              Lantik ({selectedIds.size})
            </Button>
          )}
          {activeTab === 'archived' && canManage && stats.archived > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Broom className="w-4 h-4 text-pending-700" />}
              onClick={handlePurgeAllArchived}
              title="Hapus permanen seluruh calon yang diarsipkan"
            >
              Bersihkan Seluruh Arsip
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col items-stretch gap-2.5 rounded-panel border border-rule bg-paper-raised p-2.5 md:flex-row md:items-center md:justify-between sm:p-3">
        <Field
          id="candidate-workspace-field-1"
          label="Cari Calon Anggota"
          control="text"
          value={search}
          onChange={setSearch}
          placeholder="Cari nama calon, ID/NIM, email, atau telepon..."
          className="flex-1"
          controlClassName="py-2 pl-9 pr-8 text-xs"
          leadingIcon={<MagnifyingGlass className="h-4 w-4" />}
          trailing={
            search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Hapus teks pencarian"
                className="rounded-full p-0.5 text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
        />

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto sm:flex-nowrap">
          {/* Batch / Angkatan Filter (Arsip Calon only) */}
          {activeTab === 'archived' && (
            <Field
              id="candidate-workspace-field-2"
              label="Filter Angkatan"
              control="select"
              value={selectedGroup}
              onChange={setSelectedGroup}
              className="min-w-[130px] flex-1 sm:flex-initial"
              controlClassName="py-2 pl-8 pr-7 text-xs font-medium"
              leadingIcon={<Users className="h-3.5 w-3.5" />}
              hideSelectArrow
              trailing={<FunnelSimple className="h-3 w-3 text-ink-2" />}
              options={[
                { value: '', label: 'Semua Angkatan' },
                ...availableGroups.map((grp) => ({ value: grp, label: grp })),
              ]}
            />
          )}

          {((activeTab === 'active' && Boolean(search)) ||
            (activeTab === 'archived' && Boolean(search || selectedGroup))) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedGroup('');
              }}
              aria-label="Reset semua filter calon"
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-chip border border-pen-200 bg-pen-50/70 px-3 py-2 text-xs font-semibold text-pen-deep transition-colors hover:bg-pen-50/70 hover:text-ink',
                focusRing
              )}
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              loadCandidates({ forceRefresh: true });
              loadStats({ forceRefresh: true });
            }}
            aria-label="Refresh daftar calon"
            className={cn(
              'flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-chip border border-rule-strong bg-paper px-2.5 py-2 text-ink-2 transition-colors hover:text-ink',
              focusRing
            )}
            title="Refresh"
          >
            <ArrowClockwise className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Candidate List Render */}
      {loading ? null : candidates.length === 0 ? (
        <EmptyState
          icon={activeTab === 'active' ? Sparkle : Archive}
          title={
            activeTab === 'active'
              ? 'Belum ada calon anggota aktif'
              : 'Tidak ada data calon diarsipkan'
          }
          description={
            activeTab === 'active'
              ? 'Daftarkan calon anggota baru untuk melacak keaktifan sebelum dilakukan pelantikan resmi.'
              : 'Calon anggota yang tidak terpilih atau diparkir akan tersimpan rapi di sini.'
          }
        />
      ) : (
        <RowList
          items={candidateRows}
          selectedIds={selectedIds}
          onToggle={handleToggleSelect}
          onToggleAll={handleToggleSelectAll}
          selectable={canManage}
          itemLabel="calon anggota"
        />
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
        actions={bulkActions}
      />

      {/* Candidate Induction Modal */}
      <CandidateInductionModal
        isOpen={isInductionOpen}
        onClose={() => {
          setIsInductionOpen(false);
          setInductingCandidates([]);
        }}
        selectedCandidates={inductingCandidates}
        allCandidatesCount={activeTab === 'active' ? candidates.length : undefined}
        divisionList={divisions}
        batchGroup={selectedGroup || undefined}
        onSuccess={() => {
          setSelectedIds(new Set());
          loadCandidates({ forceRefresh: true });
          loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        }}
      />


      {/* Guest Picker Modal */}
      {isGuestPickerOpen && (
        <ModalPortal onClose={() => setIsGuestPickerOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-picker-title"
            className="relative mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-panel border border-rule bg-paper p-4 text-ink shadow-lift sm:p-6"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-rule pb-3 sm:pb-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel bg-pen-50 text-pen-deep sm:h-10 sm:w-10">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="guest-picker-title" className="truncate font-heading text-base font-bold text-ink sm:text-lg">
                    Pilih Peserta Tamu
                  </h2>
                  <p className="truncate text-[11px] text-ink-2 sm:text-xs">
                    Pilih tamu kegiatan yang akan dimigrasikan ke status Calon Anggota
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuestPickerOpen(false)}
                aria-label="Tutup dialog"
                className={cn(
                  'shrink-0 rounded-full bg-paper-raised p-1.5 text-ink-2 transition-colors hover:bg-paper hover:text-ink sm:p-2',
                  focusRing
                )}
              >
                <X className="h-4 w-4 sm:h-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto py-3.5 pr-1 sm:py-4">
              <Field
                id="guest-search-field"
                label="Cari Tamu"
                control="text"
                value={guestSearch}
                onChange={setGuestSearch}
                placeholder="Cari berdasarkan nama atau kode tamu..."
                leadingIcon={<MagnifyingGlass className="h-4 w-4 text-ink-2" />}
              />

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs font-semibold text-ink">
                  {filteredGuests.length} Tamu Ditemukan ({selectedGuestIds.size} dipilih)
                </p>
                {filteredGuests.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllGuests}
                    className={cn(
                      'text-xs font-semibold text-pen-deep transition-colors hover:underline',
                      focusRing
                    )}
                  >
                    {selectedGuestIds.size === filteredGuests.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                  </button>
                )}
              </div>

              {guestLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-ink-2">
                  <ArrowClockwise className="mr-2 h-4 w-4 animate-spin text-pen-deep" />
                  Memuat daftar peserta tamu...
                </div>
              ) : filteredGuests.length === 0 ? (
                <div className="rounded-panel border border-dashed border-rule bg-paper-sunk/30 py-8 text-center text-xs text-ink-2">
                  Tidak ada data peserta tamu yang ditemukan.
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-panel border border-rule bg-paper-sunk/30 p-2">
                  {filteredGuests.map((g) => {
                    const isSelected = selectedGuestIds.has(g.id);
                    return (
                      <label
                        key={g.id}
                        className={cn(
                          'flex cursor-pointer items-center justify-between rounded-chip border p-2.5 transition-colors',
                          isSelected
                            ? 'border-pen-300 bg-pen-50/70 text-ink'
                            : 'border-rule bg-paper text-ink hover:bg-paper-raised'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleGuestSelect(g.id)}
                            className="h-4 w-4 rounded border-rule bg-paper text-pen-500 accent-pen-500"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink">{g.name}</p>
                            <p className="truncate text-[10px] text-ink-3">
                              {g.external_id} {g.group_name ? `• ${g.group_name}` : ''} {g.division ? `• ${g.division}` : ''}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-rule pt-3 sm:pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsGuestPickerOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedGuestIds.size === 0}
                onClick={() => {
                  setIsGuestPickerOpen(false);
                  setIsConvertModalOpen(true);
                }}
              >
                Lanjutkan ({selectedGuestIds.size})
              </Button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Convert Guest to Candidate Modal */}
      <ConvertGuestModal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        selectedGuests={guestsToConvert}
        divisionList={divisions}
        onSuccess={() => {
          setSelectedGuestIds(new Set());
          loadCandidates({ forceRefresh: true });
          loadStats({ forceRefresh: true });
          onRefreshGlobal?.();
        }}
      />
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        loading={confirmLoading}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
