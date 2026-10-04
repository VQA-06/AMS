import React, { useState, useEffect, useCallback } from 'react';
import { Event, Attendance, QrToken, Member, SessionType } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { invalidateCache } from '../lib/swr-client';
import { PrintableToken } from '../components/qr/PrintBadgeSheet';

export interface UseEventOperationsOptions {
  eventId: string;
  initialEvent?: Event | null;
  members: Member[];
  onRefresh?: () => void;
  onBack: () => void;
}

export interface PromotingGuestState {
  memberId: string;
  memberName: string;
  externalId: string;
  isBulk?: boolean;
  bulkCount?: number;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  type?: 'danger' | 'warning';
  confirmText?: string;
  onConfirm: () => Promise<void>;
}

export interface AlertModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info' | 'warning';
}

export function useEventOperations({
  eventId,
  initialEvent,
  members,
  onRefresh,
  onBack,
}: UseEventOperationsOptions) {
  const [event, setEvent] = useState<Event | null>(initialEvent || null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'qr' | 'overview'>('attendance');
  const [mobileViewMode, setMobileViewMode] = useState<'card' | 'table'>('card');
  const [sessionFilter, setSessionFilter] = useState<'ALL' | SessionType>('ALL');
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [qrTokens, setQrTokens] = useState<QrToken[]>([]);
  const [totalScanned, setTotalScanned] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Multi-Select state
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<Set<string>>(new Set());
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());

  // Filters
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Modals
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState<boolean>(false);
  const [isPrintSheetOpen, setIsPrintSheetOpen] = useState<boolean>(false);
  const [selectedPrintTokens, setSelectedPrintTokens] = useState<PrintableToken[] | null>(null);
  const [selectedTokenForCard, setSelectedTokenForCard] = useState<QrToken | null>(null);

  // Promote Guest Modal state
  const [promotingGuest, setPromotingGuest] = useState<PromotingGuestState | null>(null);
  const [promoteDivision, setPromoteDivision] = useState<string>('');
  const [promoteLoading, setPromoteLoading] = useState<boolean>(false);

  // Manual Attendance Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualMemberId, setManualMemberId] = useState<string>('');
  const [manualSessionType, setManualSessionType] = useState<SessionType>('CHECKIN');
  const [manualReason, setManualReason] = useState<string>('');
  const [manualLoading, setManualLoading] = useState<boolean>(false);

  // Dialog States
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: async () => {},
  });
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);

  const [alertModal, setAlertModal] = useState<AlertModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDivision) params.set('division', selectedDivision);
      if (search) params.set('search', search);

      const [attRes, qrRes, sumRes] = await Promise.all([
        fetchApi<{ attendances: Attendance[]; total: number }>(
          `/api/attendances/event/${eventId}?${params.toString()}`
        ).catch(() => ({ attendances: [], total: 0 })),
        fetchApi<{ tokens: QrToken[] }>(`/api/qr/event/${eventId}`).catch(() => ({ tokens: [] })),
        fetchApi<{ event: Event; total_scanned: number; total_tokens: number }>(
          `/api/agenda/${eventId}/summary`
        ),
      ]);

      setAttendances(attRes.attendances || []);
      setTotalScanned(attRes.total || 0);
      setQrTokens(qrRes.tokens || []);
      if (sumRes.event) setEvent(sumRes.event);
    } catch (err) {
      console.error('Failed to load event details:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedDivision, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRevokeToken = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cabut Tiket QR',
      message: 'Yakin ingin mencabut (revoke) tiket QR ini? Tiket tidak akan bisa dilihat atau digunakan lagi untuk kegiatan ini.',
      type: 'warning',
      confirmText: 'Ya, Cabut Tiket',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/qr/${id}/revoke`, { method: 'POST' });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData();
          setAlertModal({
            isOpen: true,
            title: 'Tiket Dicabut',
            message: 'Tiket QR berhasil dicabut.',
            type: 'info',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Mencabut Tiket',
            message: err instanceof Error ? err.message : 'Gagal mencabut token.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDeleteToken = (id: string, name?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Tiket Kegiatan',
      message: (
        <span>
          Yakin ingin <strong>MENGHAPUS</strong> tiket untuk <strong className="text-white">"{name || 'peserta'}"</strong> dari kegiatan ini?
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Hapus Tiket',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          const eventParam = event ? `?event_id=${event.id}` : '';
          await fetchApi(`/api/qr/${id}${eventParam}`, { method: 'DELETE' });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadData();
          setAlertModal({
            isOpen: true,
            title: 'Tiket Dihapus',
            message: 'Tiket peserta berhasil dihapus.',
            type: 'success',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Tiket',
            message: err instanceof Error ? err.message : 'Gagal menghapus tiket.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDeleteEvent = () => {
    if (!event) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Kegiatan',
      message: (
        <span>
          Yakin ingin menghapus kegiatan <strong className="text-white">"{event.name}"</strong>? Semua riwayat presensi terkait kegiatan ini akan ikut terhapus.
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Hapus Kegiatan',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/agenda/${event.id}`, { method: 'DELETE' });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          invalidateCache('/api/agenda');
          onRefresh?.();
          onBack();
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Kegiatan',
            message: err instanceof Error ? err.message : 'Gagal menghapus event.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleExportAttendance = async () => {
    if (!event) return;
    try {
      const url = `/api/attendances/export?event_id=${event.id}`;
      const csvContent = await fetchApi<string>(url);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Presensi_${event.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Ekspor Presensi',
        message: err instanceof Error ? err.message : 'Gagal mengunduh file CSV presensi.',
        type: 'error',
      });
    }
  };

  const handleToggleSelectAttendance = (id: string) => {
    setSelectedAttendanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayedAttendances = sessionFilter === 'ALL'
    ? attendances
    : attendances.filter((a) => a.session_type === sessionFilter);

  const handleSelectAllAttendances = () => {
    if (selectedAttendanceIds.size === displayedAttendances.length && displayedAttendances.length > 0) {
      setSelectedAttendanceIds(new Set());
    } else {
      setSelectedAttendanceIds(new Set(displayedAttendances.map((a) => a.id)));
    }
  };
  const handleClearAttendanceSelection = () => {
    setSelectedAttendanceIds(new Set());
  };


  const handleDeleteAttendanceBatch = () => {
    const count = selectedAttendanceIds.size;
    if (count === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Data Presensi Terpilih',
      message: (
        <span>
          Yakin ingin menghapus <strong className="text-white">{count} data presensi</strong> yang dipilih? Tindakan ini tidak dapat dibatalkan.
        </span>
      ),
      type: 'danger',
      confirmText: `Ya, Hapus (${count})`,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi('/api/attendances/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids: Array.from(selectedAttendanceIds) }),
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedAttendanceIds(new Set());
          await loadData();
          onRefresh?.();
          setAlertModal({
            isOpen: true,
            title: 'Presensi Dihapus',
            message: `${count} catatan absensi berhasil dihapus.`,
            type: 'success',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Presensi',
            message: err instanceof Error ? err.message : 'Gagal menghapus data presensi.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleToggleSelectToken = (id: string) => {
    setSelectedTokenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTokens = () => {
    if (selectedTokenIds.size === qrTokens.length && qrTokens.length > 0) {
      setSelectedTokenIds(new Set());
    } else {
      setSelectedTokenIds(new Set(qrTokens.map((t) => t.id)));
    }
  };
  const handleClearTokenSelection = () => {
    setSelectedTokenIds(new Set());
  };


  const handleRevokeTokenBatch = () => {
    const unrevoked = qrTokens.filter((t) => selectedTokenIds.has(t.id) && !t.revoked_at);
    if (unrevoked.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Cabut ${unrevoked.length} Tiket Terpilih`,
      message: (
        <span>
          Yakin ingin mencabut (revoke) <strong className="text-white">{unrevoked.length} tiket QR</strong> yang dipilih? Tiket tidak akan bisa digunakan lagi.
        </span>
      ),
      type: 'warning',
      confirmText: `Ya, Cabut (${unrevoked.length})`,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await Promise.all(
            unrevoked.map((tok) => fetchApi(`/api/qr/${tok.id}/revoke`, { method: 'POST' }))
          );
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedTokenIds(new Set());
          await loadData();
          setAlertModal({
            isOpen: true,
            title: 'Tiket Dicabut',
            message: `${unrevoked.length} tiket berhasil dinonaktifkan.`,
            type: 'info',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Mencabut Tiket',
            message: err instanceof Error ? err.message : 'Gagal mencabut tiket terpilih.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleDeleteTokenBatch = () => {
    const count = selectedTokenIds.size;
    if (count === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Tiket Terpilih',
      message: (
        <span>
          Yakin ingin menghapus <strong className="text-white">{count} tiket peserta</strong> dari kegiatan ini?
        </span>
      ),
      type: 'danger',
      confirmText: `Ya, Hapus (${count})`,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi('/api/qr/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({
              ids: Array.from(selectedTokenIds),
              event_id: event?.id,
            }),
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedTokenIds(new Set());
          await loadData();
          setAlertModal({
            isOpen: true,
            title: 'Tiket Dihapus',
            message: `${count} tiket peserta berhasil dihapus.`,
            type: 'success',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Tiket',
            message: err instanceof Error ? err.message : 'Gagal menghapus tiket.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMemberId || !manualReason.trim() || !event) return;

    setManualLoading(true);
    try {
      await fetchApi(`/api/attendances/event/${event.id}/manual`, {
        method: 'POST',
        body: JSON.stringify({
          member_id: manualMemberId,
          session_type: manualSessionType,
          reason: manualReason.trim(),
        }),
      });

      setIsManualModalOpen(false);
      setManualMemberId('');
      setManualReason('');
      await loadData();
      onRefresh?.();
      setAlertModal({
        isOpen: true,
        title: 'Presensi Manual Berhasil',
        message: 'Presensi manual berhasil dicatat.',
        type: 'success',
      });
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Presensi Manual',
        message: err instanceof Error ? err.message : 'Gagal mencatat presensi.',
        type: 'error',
      });
    } finally {
      setManualLoading(false);
    }
  };

  const handleOpenPromoteSingle = (token: QrToken) => {
    setPromoteDivision(token.member_division || '');
    setPromotingGuest({
      memberId: token.member_id,
      memberName: token.member_name || 'Peserta Tamu',
      externalId: token.member_external_id || '',
      isBulk: false,
    });
  };

  const handleOpenPromoteBulk = () => {
    const selectedTokens = qrTokens.filter(
      (t) => selectedTokenIds.has(t.id) && t.member_external_id?.startsWith('GUEST-')
    );
    if (selectedTokens.length === 0) {
      setAlertModal({
        isOpen: true,
        title: 'Tidak Ada Tamu Terpilih',
        message: 'Pilih minimal satu tiket peserta tamu (GUEST) untuk diangkat menjadi anggota resmi.',
        type: 'warning',
      });
      return;
    }

    setPromoteDivision('');
    setPromotingGuest({
      memberId: 'bulk',
      memberName: `${selectedTokens.length} Peserta Tamu`,
      externalId: '',
      isBulk: true,
      bulkCount: selectedTokens.length,
    });
  };

  const handleConfirmPromote = async () => {
    if (!promotingGuest) return;
    setPromoteLoading(true);

    try {
      if (promotingGuest.isBulk) {
        const selectedGuestMemberIds = qrTokens
          .filter((t) => selectedTokenIds.has(t.id) && t.member_external_id?.startsWith('GUEST-'))
          .map((t) => t.member_id);

        await fetchApi('/api/members/bulk-promote-guests', {
          method: 'POST',
          body: JSON.stringify({
            ids: selectedGuestMemberIds,
            division: promoteDivision || undefined,
          }),
        });

        setPromotingGuest(null);
        setSelectedTokenIds(new Set());
        await loadData();
        onRefresh?.();
        setAlertModal({
          isOpen: true,
          title: 'Pengangkatan Anggota Berhasil',
          message: `${selectedGuestMemberIds.length} peserta tamu berhasil diangkat menjadi anggota resmi organisasi! Riwayat absensi di kegiatan ini tetap tercatat utuh.`,
          type: 'success',
        });
      } else {
        await fetchApi(`/api/members/${promotingGuest.memberId}/promote-guest`, {
          method: 'POST',
          body: JSON.stringify({
            division: promoteDivision || undefined,
          }),
        });

        setPromotingGuest(null);
        await loadData();
        onRefresh?.();
        setAlertModal({
          isOpen: true,
          title: 'Pengangkatan Anggota Berhasil',
          message: `Peserta "${promotingGuest.memberName}" berhasil diangkat menjadi anggota resmi organisasi! Riwayat absensi tetap utuh.`,
          type: 'success',
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Mengangkat Anggota',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
        type: 'error',
      });
    } finally {
      setPromoteLoading(false);
    }
  };

  const sessionCounts = {
    checkin: attendances.filter((a) => a.session_type === 'CHECKIN').length,
    checkout: attendances.filter((a) => a.session_type === 'CHECKOUT').length,
    breakOut: attendances.filter((a) => a.session_type === 'BREAK_OUT').length,
    breakIn: attendances.filter((a) => a.session_type === 'BREAK_IN').length,
  };

  const printableTokens: PrintableToken[] = qrTokens
    .filter((t) => t.qr_token && !t.revoked_at)
    .map((t) => ({
      id: t.id,
      member_id: t.member_id,
      member_name: t.member_name || 'Peserta',
      member_external_id: t.member_external_id || t.member_id,
      member_division: t.member_division || null,
      qr_token: t.qr_token as string,
      scope: t.scope,
      expires_at: t.expires_at,
      event_name: event?.name || null,
    }));
  return {
    event,
    setEvent,
    activeTab,
    setActiveTab,
    mobileViewMode,
    setMobileViewMode,
    sessionFilter,
    setSessionFilter,
    attendances,
    qrTokens,
    totalScanned,
    loading,
    selectedAttendanceIds,
    setSelectedAttendanceIds,
    selectedTokenIds,
    setSelectedTokenIds,
    selectedDivision,
    setSelectedDivision,
    search,
    setSearch,
    isQrModalOpen,
    setIsQrModalOpen,
    isGuestModalOpen,
    setIsGuestModalOpen,
    isPrintSheetOpen,
    selectedPrintTokens,
    setSelectedPrintTokens,
    setIsPrintSheetOpen,
    selectedTokenForCard,
    setSelectedTokenForCard,
    promotingGuest,
    setPromotingGuest,
    promoteDivision,
    setPromoteDivision,
    promoteLoading,
    isManualModalOpen,
    setIsManualModalOpen,
    manualMemberId,
    setManualMemberId,
    manualSessionType,
    setManualSessionType,
    manualReason,
    setManualReason,
    manualLoading,
    confirmDialog,
    setConfirmDialog,
    confirmLoading,
    alertModal,
    setAlertModal,
    displayedAttendances,
    sessionCounts,
    printableTokens,
    loadData,
    handleRevokeToken,
    handleDeleteToken,
    handleDeleteEvent,
    handleExportAttendance,
    handleToggleSelectAttendance,
    handleSelectAllAttendances,
    handleDeleteAttendanceBatch,
    handleClearAttendanceSelection,
    handleToggleSelectToken,
    handleSelectAllTokens,
    handleRevokeTokenBatch,
    handleDeleteTokenBatch,
    handleClearTokenSelection,
    handleManualSubmit,
    handleOpenPromoteSingle,
    handleOpenPromoteBulk,
    handleConfirmPromote,
  };
}
