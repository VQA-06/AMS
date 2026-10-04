import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Building2,
  Plus,
  Upload,
  Download,
  Filter,
  RefreshCw,
  Printer,
  QrCode,
  X,
  Trash2,
  UserX,
} from 'lucide-react';
import { Member, QrToken } from '@/shared/types';
import { MemberInput } from '@/shared/schemas/member.schema';
import { fetchApi } from '../lib/api-client';
import { fetchCached, invalidateCache } from '../lib/swr-client';
import { useAuth } from '../hooks/useAuth';
import { canManageMembers, canExportData, canGenerateQR } from '../lib/permissions';
import { MemberList } from '../components/members/MemberList';
import { MemberFormModal } from '../components/members/MemberFormModal';
import { ImportWizard } from '../components/members/ImportWizard';
import { DigitalPassCard } from '../components/qr/DigitalPassCard';
import { PrintBadgeSheet, PrintableToken } from '../components/qr/PrintBadgeSheet';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';
import { ModalPortal } from '../components/ui/ModalPortal';
import { Button } from '../components/ui/Button';

import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';
import { UserCheck } from 'lucide-react';

interface MembersPageProps {
  onGenerateQrForMember: (member: Member) => void;
  openAddModalTrigger?: boolean;
  onResetAddModalTrigger?: () => void;
  onRefreshGlobal?: () => void;
}

export const MembersPage: React.FC<MembersPageProps> = ({
  onGenerateQrForMember,
  openAddModalTrigger,
  onResetAddModalTrigger,
  onRefreshGlobal,
}) => {
  const { admin } = useAuth();
  const isManager = canManageMembers(admin?.role);
  const canExport = canExportData(admin?.role);
  const canGenerate = canGenerateQR(admin?.role);

  const [members, setMembers] = useState<Member[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);

  // Multi-Select state
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState<boolean>(false);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    type?: 'danger' | 'warning';
    confirmText?: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: async () => {},
  });
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'error' | 'success' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });

  // QR Modals
  const [selectedPassData, setSelectedPassData] = useState<{
    tokenString: string;
    memberName: string;
    memberExternalId: string;
    memberDivision?: string | null;
    expiresAt: string;
  } | null>(null);

  const [isPrintSheetOpen, setIsPrintSheetOpen] = useState<boolean>(false);
  const [bulkPrintTokens, setBulkPrintTokens] = useState<PrintableToken[]>([]);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  const loadMembers = useCallback(async (opts?: { forceRefresh?: boolean }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedDivision) params.set('division', selectedDivision);
      if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
      params.set('limit', '100');

      const url = `/api/members?${params.toString()}`;
      const res = await fetchCached<{ members: Member[]; total: number }>(url, {
        forceRefresh: opts?.forceRefresh,
        ttlMs: 30_000,
      });
      setMembers(res.members || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedDivision, selectedStatus]);

  const loadOptions = async (opts?: { forceRefresh?: boolean }) => {
    try {
      const [divRes, grpRes] = await Promise.all([
        fetchCached<{ divisions: string[] }>('/api/members/divisions', { forceRefresh: opts?.forceRefresh }),
        fetchCached<{ groups: string[] }>('/api/members/groups', { forceRefresh: opts?.forceRefresh }),
      ]);
      setDivisions(divRes.divisions || []);
      setGroups(grpRes.groups || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadMembers();
    loadOptions();

    // Listen for realtime mutation events across tabs and modals
    const handleMutation = () => {
      loadMembers({ forceRefresh: true });
      loadOptions({ forceRefresh: true });
    };

    window.addEventListener('ams:data-mutated', handleMutation);
    return () => {
      window.removeEventListener('ams:data-mutated', handleMutation);
    };
  }, [loadMembers]);

  useEffect(() => {
    if (openAddModalTrigger) {
      setEditingMember(null);
      setIsFormOpen(true);
      onResetAddModalTrigger?.();
    }
  }, [openAddModalTrigger, onResetAddModalTrigger]);

  const handleSaveMember = async (data: MemberInput) => {
    if (editingMember) {
      await fetchApi(`/api/members/${editingMember.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } else {
      await fetchApi('/api/members', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
    invalidateCache('/api/members');
    invalidateCache('/api/attendances');
    await loadMembers({ forceRefresh: true });
    await loadOptions({ forceRefresh: true });
    onRefreshGlobal?.();
  };

  const handleDeactivate = (id: string, name?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Nonaktifkan Anggota',
      message: (
        <span>
          Yakin ingin menonaktifkan status keanggotaan <strong>"{name || 'anggota ini'}"</strong>?
          Akses tiket dan akun tim (jika ada) akan otomatis dinonaktifkan.
        </span>
      ),
      type: 'warning',
      confirmText: 'Ya, Nonaktifkan',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/members/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'inactive' }),
          });
          invalidateCache('/api/members');
          invalidateCache('/api/attendances');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadMembers({ forceRefresh: true });
          onRefreshGlobal?.();
          setAlertModal({
            isOpen: true,
            title: 'Anggota Dinonaktifkan',
            message: `Anggota "${name || id}" berhasil dinonaktifkan.`,
            type: 'success',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menonaktifkan',
            message: err instanceof Error ? err.message : 'Gagal menonaktifkan anggota.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Anggota Permanen',
      message: (
        <span>
          Yakin ingin <strong>MENGHAPUS PERMANEN</strong> anggota <strong className="text-white">"{name}"</strong> beserta seluruh riwayat QR, absensi, dan akun panitia terkait?
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Hapus Permanen',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/members/${id}`, { method: 'DELETE' });
          invalidateCache('/api/members');
          invalidateCache('/api/attendances');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadMembers({ forceRefresh: true });
          await loadOptions({ forceRefresh: true });
          onRefreshGlobal?.();
          setAlertModal({
            isOpen: true,
            title: 'Anggota Dihapus',
            message: `Anggota "${name}" dan seluruh datanya berhasil dihapus permanen.`,
            type: 'success',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Anggota',
            message: err instanceof Error ? err.message : 'Gagal menghapus anggota.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleViewPass = async (member: Member) => {
    try {
      setLoading(true);
      const res = await fetchApi<{
        token: {
          id: string;
          qr_token: string;
          member_name: string;
          member_external_id: string;
          member_division: string | null;
          expires_at: string;
        };
      }>(`/api/members/${member.id}/universal-qr`);

      if (res.token) {
        setSelectedPassData({
          tokenString: res.token.qr_token,
          memberName: res.token.member_name || member.name,
          memberExternalId: res.token.member_external_id || member.external_id,
          memberDivision: res.token.member_division || member.division,
          expiresAt: res.token.expires_at,
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Memuat QR Pass',
        message: err instanceof Error ? err.message : 'Gagal memuat QR Anggota.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBulkPrint = async () => {
    try {
      setBulkLoading(true);
      const res = await fetchApi<{ tokens: PrintableToken[] }>('/api/members/universal-tokens');
      setBulkPrintTokens(res.tokens || []);
      setIsPrintSheetOpen(true);
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Memuat Tiket Cetak',
        message: err instanceof Error ? err.message : 'Gagal memuat tiket QR Universal anggota.',
        type: 'error',
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedMemberIds((prev) => {
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
    if (selectedMemberIds.size === members.length && members.length > 0) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(members.map((m) => m.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedMemberIds(new Set());
  };

  const handleBulkPrintSelected = async () => {
    const ids = Array.from(selectedMemberIds);
    if (ids.length === 0) return;
    try {
      setBulkActionLoading(true);
      const res = await fetchApi<{ tokens: PrintableToken[] }>('/api/members/bulk-tokens', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      setBulkPrintTokens(res.tokens || []);
      setIsPrintSheetOpen(true);
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Memuat Tiket Cetak',
        message: err instanceof Error ? err.message : 'Gagal memuat tiket QR Universal.',
        type: 'error',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDeactivateSelected = () => {
    const ids = Array.from(selectedMemberIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Nonaktifkan ${ids.length} Anggota`,
      message: (
        <span>
          Apakah Anda yakin ingin menonaktifkan status <strong>{ids.length} anggota</strong> terpilih?
        </span>
      ),
      type: 'warning',
      confirmText: 'Ya, Nonaktifkan',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/members/bulk-deactivate', {
            method: 'POST',
            body: JSON.stringify({ ids }),
          });
          invalidateCache('/api/members');
          invalidateCache('/api/attendances');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedMemberIds(new Set());
          await loadMembers({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menonaktifkan Anggota',
            message: err instanceof Error ? err.message : 'Gagal menonaktifkan anggota.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleBulkDeleteSelected = () => {
    const ids = Array.from(selectedMemberIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Hapus Permanen ${ids.length} Anggota`,
      message: (
        <span>
          Tindakan ini <strong>tidak dapat dibatalkan</strong>. Seluruh riwayat presensi dan tiket QR dari{' '}
          <strong>{ids.length} anggota</strong> yang dipilih akan dihapus permanen.
        </span>
      ),
      type: 'danger',
      confirmText: 'Hapus Permanen',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/members/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids }),
          });
          invalidateCache('/api/members');
          invalidateCache('/api/attendances');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedMemberIds(new Set());
          await loadMembers({ forceRefresh: true });
          await loadOptions({ forceRefresh: true });
          onRefreshGlobal?.();
        } catch (err) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Anggota',
            message: err instanceof Error ? err.message : 'Gagal menghapus anggota.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const bulkActions: BulkActionItem[] = [
    ...(canGenerate
      ? [
          {
            label: 'Cetak QR',
            icon: <Printer className="w-3.5 h-3.5" />,
            variant: 'primary' as const,
            onClick: handleBulkPrintSelected,
            loading: bulkActionLoading,
          },
        ]
      : []),
    ...(isManager
      ? [
          {
            label: 'Nonaktifkan',
            icon: <UserX className="w-3.5 h-3.5" />,
            variant: 'warning' as const,
            onClick: handleBulkDeactivateSelected,
          },
          {
            label: 'Hapus',
            icon: <Trash2 className="w-3.5 h-3.5" />,
            variant: 'danger' as const,
            onClick: handleBulkDeleteSelected,
          },
        ]
      : []),
  ];

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedDivision) params.set('division', selectedDivision);
    if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
    params.set('format', 'csv');

    window.open(`/api/members/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-sky-400" />
            <span>Manajemen Anggota</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola data anggota master, cetak seluruh kartu pass QR ke A4 / PDF, impor CSV
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isManager && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-400">
              Mode Read-Only
            </span>
          )}

          {canGenerate && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer className="w-4 h-4 text-sky-400" />}
              onClick={handleOpenBulkPrint}
              loading={bulkLoading}
              title="Cetak A4 / Simpan PDF QR Universal Seluruh Anggota Aktif"
            >
              Cetak Semua Badge / PDF
            </Button>
          )}

          {isManager && (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingMember(null);
                  setIsFormOpen(true);
                }}
              >
                Tambah Anggota
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={<Upload className="w-4 h-4 text-sky-400" />}
                onClick={() => setIsImportOpen(true)}
              >
                Impor CSV / Excel
              </Button>
            </>
          )}

          {canExport && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4 text-emerald-400" />}
              onClick={handleExportCsv}
              title="Ekspor CSV Anggota"
            >
              Ekspor CSV
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel p-2.5 sm:p-3 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            aria-label="Cari anggota"
            placeholder="Cari berdasarkan nama, NIM/ID, email, atau no HP..."
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

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
          {/* Division Filter */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              aria-label="Filter berdasarkan Divisi"
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

          {/* Status Filter */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter berdasarkan Status"
              className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-medium text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Semua Status</option>
              <option value="active" className="bg-slate-900">Aktif</option>
              <option value="inactive" className="bg-slate-900">Nonaktif</option>
            </select>
            <Filter className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {(search || selectedDivision || (selectedStatus && selectedStatus !== 'all')) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedDivision('');
                setSelectedStatus('all');
              }}
              aria-label="Reset semua filter"
              className="px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:text-white hover:bg-rose-900/60 text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => loadMembers({ forceRefresh: true })}
            aria-label="Refresh daftar anggota"
            className="min-w-[36px] min-h-[36px] px-2.5 py-2 flex items-center justify-center glass-panel text-slate-400 hover:text-white rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Member List */}
      <MemberList
        members={members}
        loading={loading}
        canManage={isManager}
        selectedIds={selectedMemberIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        isAllSelected={members.length > 0 && selectedMemberIds.size === members.length}
        onEdit={(m) => {
          setEditingMember(m);
          setIsFormOpen(true);
        }}
        onDeactivate={handleDeactivate}
        onDelete={handleDelete}
        onGenerateQr={onGenerateQrForMember}
        onViewPass={handleViewPass}
      />

      {/* Contextual Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedMemberIds.size}
        totalCount={members.length}
        itemLabel="Anggota"
        onClearSelection={handleClearSelection}
        onSelectAll={handleToggleSelectAll}
        isAllSelected={members.length > 0 && selectedMemberIds.size === members.length}
        actions={bulkActions}
      />

      {/* Modals */}
      <MemberFormModal
        isOpen={isFormOpen}
        member={editingMember}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveMember}
        divisionList={divisions}
        groupList={groups}
      />

      {/* Individual Digital Pass Card View Modal */}
      {selectedPassData && (
        <ModalPortal onClose={() => setSelectedPassData(null)}>
          <div className="modal-backdrop-full">
            <DigitalPassCard
              tokenString={selectedPassData.tokenString}
              memberName={selectedPassData.memberName}
              memberExternalId={selectedPassData.memberExternalId}
              memberDivision={selectedPassData.memberDivision}
              scope="universal"
              expiresAt={selectedPassData.expiresAt}
              onClose={() => setSelectedPassData(null)}
            />
          </div>
        </ModalPortal>
      )}

      {/* Bulk Print Sheet (Clean A4 Print Window) */}
      <PrintBadgeSheet
        isOpen={isPrintSheetOpen}
        onClose={() => setIsPrintSheetOpen(false)}
        tokens={bulkPrintTokens}
        eventName="Kartu Absensi Universal"
      />

      {isImportOpen && (
        <ModalPortal onClose={() => setIsImportOpen(false)}>
          <div className="modal-backdrop-full">
            <div className="w-full max-w-4xl my-auto max-h-[92dvh] overflow-y-auto">
              <ImportWizard
                onSuccess={() => {
                  setIsImportOpen(false);
                  invalidateCache('/api/members');
                  invalidateCache('/api/attendances');
                  loadMembers({ forceRefresh: true });
                  loadOptions({ forceRefresh: true });
                  onRefreshGlobal?.();
                }}
                onCancel={() => setIsImportOpen(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={confirmDialog.confirmText}
        loading={confirmLoading}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Alert Notification Modal */}
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
