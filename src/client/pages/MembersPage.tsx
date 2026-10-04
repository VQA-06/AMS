import React, { useState, useEffect, useCallback } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { FunnelSimple } from '@phosphor-icons/react/FunnelSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/Plus';
import { Printer } from '@phosphor-icons/react/Printer';
import { Trash } from '@phosphor-icons/react/Trash';
import { UploadSimple } from '@phosphor-icons/react/UploadSimple';
import { UserMinus } from '@phosphor-icons/react/UserMinus';
import { Warning } from '@phosphor-icons/react/Warning';
import { X } from '@phosphor-icons/react/X';
import { Member } from '@/shared/types';
import { MemberInput } from '@/shared/schemas/member.schema';
import { fetchApi } from '../lib/api-client';
import { fetchCached, invalidateCache } from '../lib/swr-client';
import { cn } from '../lib/cn';
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
import { Field } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';

/** One focus quartet. Never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

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

  // Which sections failed to load. A failed fetch is never rendered as a zero.
  const [failedSections, setFailedSections] = useState<string[]>([]);
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
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedDivision) params.set('division', selectedDivision);
    if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
    params.set('limit', '100');

    const url = `/api/members?${params.toString()}`;
    try {
      const res = await fetchCached<{ members: Member[]; total: number }>(url, {
        forceRefresh: opts?.forceRefresh,
        ttlMs: 30_000,
      });
      setMembers(res.members || []);
      setTotal(res.total || 0);
      setFailedSections([]);
    } catch (err) {
      // Never render a failed fetch as a plausible zero: keep the last good
      // rows and name the failure in the banner instead.
      console.error('Failed to load members:', err);
      setFailedSections(['anggota']);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedDivision, selectedStatus]);

  const loadOptions = async (opts?: { forceRefresh?: boolean }) => {
    const [divRes, grpRes] = await Promise.allSettled([
      fetchCached<{ divisions: string[] }>('/api/members/divisions', { forceRefresh: opts?.forceRefresh }),
      fetchCached<{ groups: string[] }>('/api/members/groups', { forceRefresh: opts?.forceRefresh }),
    ]);
    setDivisions(divRes.status === 'fulfilled' ? divRes.value.divisions || [] : []);
    setGroups(grpRes.status === 'fulfilled' ? grpRes.value.groups || [] : []);
    setFailedSections((prev) => {
      const rest = prev.filter((s) => s !== 'divisi' && s !== 'grup');
      if (divRes.status === 'rejected') rest.push('divisi');
      if (grpRes.status === 'rejected') rest.push('grup');
      return rest;
    });
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


  const handleDelete = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Anggota Permanen',
      message: (
        <span>
          Yakin ingin <strong>MENGHAPUS PERMANEN</strong> anggota <strong className="text-ink">"{name}"</strong> beserta seluruh riwayat QR, absensi, dan akun panitia terkait?
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
            icon: <UserMinus className="w-3.5 h-3.5" />,
            variant: 'warning' as const,
            onClick: handleBulkDeactivateSelected,
          },
          {
            label: 'Hapus',
            icon: <Trash className="w-3.5 h-3.5" />,
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
    <div className="space-y-5 pb-24 md:space-y-8">
      <PageHeader
        title="Manajemen Anggota"
        subtitle="Kelola data anggota master, cetak seluruh kartu pass QR ke A4 / PDF, impor CSV"
        actions={
          <>
            {!isManager && (
              <span className="rounded-chip border border-rule-strong bg-paper px-3 py-1.5 text-xs font-semibold text-ink-2">
                Mode Read-Only
              </span>
            )}

            {canGenerate && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Printer className="w-4 h-4 text-ink-2" />}
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
                  icon={<UploadSimple className="w-4 h-4 text-ink-2" />}
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
                icon={<DownloadSimple className="w-4 h-4 text-seal-600" />}
                onClick={handleExportCsv}
                title="Ekspor CSV Anggota"
              >
                Ekspor CSV
              </Button>
            )}
          </>
        }
      />

      {/* Honest partial-failure notice: a failed fetch is never a zero. */}
      {failedSections.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-panel border border-pending-200 bg-pending-50/70 px-3 py-2.5 text-xs text-pending-800"
        >
          <Warning className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          <p>
            Sebagian data gagal dimuat: {failedSections.join(', ')}. Angka di bawah mungkin tidak
            lengkap, bukan nol.
          </p>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col items-stretch gap-2.5 rounded-panel border border-rule bg-paper-raised p-2.5 md:flex-row md:items-center md:justify-between sm:p-3">
        <Field
          id="members-page-field-1"
          label="Cari Anggota"
          control="text"
          value={search}
          onChange={setSearch}
          placeholder="Cari berdasarkan nama, NIM/ID, email, atau no HP..."
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
          {/* Division Filter */}
          <Field
            id="members-page-field-2"
            label="Filter Divisi"
            control="select"
            value={selectedDivision}
            onChange={setSelectedDivision}
            className="min-w-[140px] flex-1 sm:flex-initial"
            controlClassName="py-2 pl-8 pr-7 text-xs font-medium"
            leadingIcon={<Buildings className="h-3.5 w-3.5" />}
            hideSelectArrow
            trailing={<FunnelSimple className="h-3 w-3 text-ink-2" />}
            options={[
              { value: '', label: 'Semua Divisi' },
              ...divisions.map((div) => ({ value: div, label: div })),
            ]}
          />

          {/* Status Filter */}
          <Field
            id="members-page-field-3"
            label="Filter Status"
            control="select"
            value={selectedStatus}
            onChange={setSelectedStatus}
            className="min-w-[140px] flex-1 sm:flex-initial"
            controlClassName="py-2 px-3 text-xs font-medium"
            hideSelectArrow
            trailing={<FunnelSimple className="h-3 w-3 text-ink-2" />}
            options={[
              { value: 'all', label: 'Semua Status' },
              { value: 'active', label: 'Aktif' },
              { value: 'inactive', label: 'Nonaktif' },
            ]}
          />

          {(search || selectedDivision || (selectedStatus && selectedStatus !== 'all')) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedDivision('');
                setSelectedStatus('all');
              }}
              aria-label="Reset semua filter"
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
            onClick={() => loadMembers({ forceRefresh: true })}
            aria-label="Refresh daftar anggota"
            className={cn(
              'flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-chip border border-rule-strong bg-paper px-2.5 py-2 text-ink-2 transition-colors hover:text-ink',
              focusRing
            )}
            title="Refresh"
          >
            <ArrowClockwise className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
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
        onDelete={handleDelete}
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
