import React, { useState, useEffect, useCallback } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Printer } from '@phosphor-icons/react/Printer';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { ShieldWarning } from '@phosphor-icons/react/ShieldWarning';
import { Trash } from '@phosphor-icons/react/Trash';
import { UserCheck } from '@phosphor-icons/react/UserCheck';
import { Warning } from '@phosphor-icons/react/Warning';
import { X } from '@phosphor-icons/react/X';
import { Event, Attendance, QrToken, Member, SessionType } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { invalidateCache } from '../lib/swr-client';
import { useAuth } from '../hooks/useAuth';
import { canManageEvents, canExportData, canGenerateQR } from '../lib/permissions';
import { QrGeneratorModal } from '../components/qr/QrGeneratorModal';
import { PrintBadgeSheet, PrintableToken } from '../components/qr/PrintBadgeSheet';
import { filterPrintableTokens } from '../lib/qr-tokens';
import { GuestPassModal } from '../components/events/GuestPassModal';
import { DigitalPassCard } from '../components/qr/DigitalPassCard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';
import { ModalPortal } from '../components/ui/ModalPortal';
import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';
import { Tabs } from '../components/ui/Tabs';
import { Field } from '../components/ui/Field';
import { EventHeaderSummary } from '../components/events/EventHeaderSummary';
import { AttendanceRosterTable } from '../components/events/AttendanceRosterTable';
import { GuestPassWorkspace } from '../components/events/GuestPassWorkspace';
import { Button } from '../components/ui/Button';

interface EventDetailPageProps {
  eventId: string;
  event?: Event | null;
  onBack: () => void;
  onScanEvent?: (event: Event) => void;
  members: Member[];
  divisions: string[];
  events: Event[];
  onRefresh?: () => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  eventId,
  event: initialEvent,
  onBack,
  onScanEvent,
  members,
  divisions,
  events,
  onRefresh,
}) => {
  const { admin } = useAuth();
  const isManager = canManageEvents(admin?.role);
  const canExport = canExportData(admin?.role);
  const canGenerate = canGenerateQR(admin?.role);

  const [event, setEvent] = useState<Event | null>(initialEvent || null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'qr' | 'overview'>('attendance');
  const [mobileViewMode, setMobileViewMode] = useState<'card' | 'table'>('card');
  const [sessionFilter, setSessionFilter] = useState<'ALL' | SessionType>('ALL');
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [qrTokens, setQrTokens] = useState<QrToken[]>([]);
  const [totalScanned, setTotalScanned] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  /** Sections that failed to load; renders as a warning, not as zero counts. */
  const [partialErrors, setPartialErrors] = useState<string[]>([]);

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
  const [promotingGuest, setPromotingGuest] = useState<{
    memberId: string;
    memberName: string;
    externalId: string;
    isBulk?: boolean;
    bulkCount?: number;
  } | null>(null);
  const [promoteDivision, setPromoteDivision] = useState<string>('');
  const [promoteLoading, setPromoteLoading] = useState<boolean>(false);

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualMemberId, setManualMemberId] = useState<string>('');
  const [manualSessionType, setManualSessionType] = useState<SessionType>('CHECKIN');
  const [manualReason, setManualReason] = useState<string>('');
  const [manualLoading, setManualLoading] = useState<boolean>(false);

  // Dialog States
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

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDivision) params.set('division', selectedDivision);
      if (search) params.set('search', search);

      const settled = await Promise.allSettled([
        fetchApi<{ attendances: Attendance[]; total: number }>(
          `/api/attendances/event/${eventId}?${params.toString()}`
        ),
        fetchApi<{ tokens: QrToken[] }>(`/api/qr/event/${eventId}`),
        fetchApi<{ event: Event; total_scanned: number; total_tokens: number }>(
          `/api/agenda/${eventId}/summary`
        ),
      ]);

      // A failed request used to fall back to an empty list, so an outage
      // rendered as "0 attendances" — indistinguishable from a real zero.
      const failed = ['Daftar Kehadiran', 'Token QR', 'Ringkasan Kegiatan'];
      setPartialErrors(
        settled.flatMap((r, i) => (r.status === 'rejected' ? [failed[i]] : []))
      );

      const [attRes, qrRes, sumRes] = settled.map((r) =>
        r.status === 'fulfilled' ? r.value : null
      ) as [
        { attendances: Attendance[]; total: number } | null,
        { tokens: QrToken[] } | null,
        { event: Event; total_scanned: number; total_tokens: number } | null,
      ];

      setAttendances(attRes?.attendances || []);
      setTotalScanned(attRes?.total || 0);
      setQrTokens(qrRes?.tokens || []);
      if (sumRes?.event) setEvent(sumRes.event);
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
          Yakin ingin <strong>MENGHAPUS</strong> tiket untuk <strong className="text-ink">"{name || 'peserta'}"</strong> dari kegiatan ini?
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
      title: 'Hapus Kegiatan Permanen',
      message: (
        <span>
          Yakin ingin <strong>MENGHAPUS PERMANEN</strong> kegiatan <strong className="text-ink">"{event.name}"</strong> beserta seluruh riwayat data absensi dan tiketnya?
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Hapus Permanen',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/agenda/${event.id}`, { method: 'DELETE' });
          invalidateCache('/api/agenda');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          onRefresh?.();
          onBack();
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menghapus Kegiatan',
            message: err instanceof Error ? err.message : 'Gagal menghapus kegiatan.',
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
    if (!event || !manualMemberId || !manualReason.trim()) return;

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
      setAlertModal({
        isOpen: true,
        title: 'Absensi Manual Berhasil',
        message: 'Kehadiran peserta berhasil dicatat secara manual.',
        type: 'success',
      });
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Absensi Manual',
        message: err instanceof Error ? err.message : 'Gagal mencatat absensi manual.',
        type: 'error',
      });
    } finally {
      setManualLoading(false);
    }
  };

  // Attendance Multi-Select
  const handleToggleSelectAttendance = (id: string) => {
    setSelectedAttendanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllAttendances = (list: Attendance[]) => {
    if (selectedAttendanceIds.size === list.length && list.length > 0) {
      setSelectedAttendanceIds(new Set());
    } else {
      setSelectedAttendanceIds(new Set(list.map((a) => a.id)));
    }
  };

  const handleClearAttendanceSelection = () => {
    setSelectedAttendanceIds(new Set());
  };

  const handleBulkDeleteAttendances = () => {
    const ids = Array.from(selectedAttendanceIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Hapus ${ids.length} Catatan Presensi`,
      message: (
        <span>
          Apakah Anda yakin ingin menghapus <strong>{ids.length} catatan kehadiran</strong> yang dipilih?
        </span>
      ),
      type: 'danger',
      confirmText: 'Hapus Presensi',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/attendances/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids }),
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedAttendanceIds(new Set());
          await loadData();
          onRefresh?.();
        } catch (err) {
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

  // Token Multi-Select
  const handleToggleSelectToken = (id: string) => {
    setSelectedTokenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllTokens = () => {
    if (selectedTokenIds.size === qrTokens.length && qrTokens.length > 0) {
      setSelectedTokenIds(new Set());
    } else {
      setSelectedTokenIds(new Set(qrTokens.map((t) => t.id)));
    }
  };

  const handleClearTokenSelection = () => {
    setSelectedTokenIds(new Set());
  };

  const handleBulkDeleteSelectedTokens = () => {
    const ids = Array.from(selectedTokenIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Hapus ${ids.length} Tiket QR`,
      message: (
        <span>
          Apakah Anda yakin ingin menghapus <strong>{ids.length} tiket QR</strong> terpilih?
        </span>
      ),
      type: 'danger',
      confirmText: 'Hapus Tiket',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          const eventParam = event ? `?event_id=${event.id}` : '';
          for (const id of ids) {
            await fetchApi(`/api/qr/${id}${eventParam}`, { method: 'DELETE' });
          }
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedTokenIds(new Set());
          await loadData();
        } catch (err) {
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

  const handleBulkRevokeSelectedTokens = () => {
    const unrevoked = qrTokens.filter((t) => selectedTokenIds.has(t.id) && !t.revoked_at);
    if (unrevoked.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Cabut ${unrevoked.length} Tiket QR`,
      message: (
        <span>
          Apakah Anda yakin ingin mencabut (revoke) <strong>{unrevoked.length} tiket QR</strong> terpilih? Tiket tidak akan bisa dilihat atau digunakan lagi untuk kegiatan ini.
        </span>
      ),
      type: 'warning',
      confirmText: `Ya, Cabut (${unrevoked.length})`,
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await Promise.all(
            unrevoked.map((tok) => fetchApi(`/api/qr/${tok.id}/revoke`, { method: 'POST' }))
          );
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedTokenIds(new Set());
          await loadData();
          setAlertModal({
            isOpen: true,
            title: 'Tiket Dicabut',
            message: `${unrevoked.length} tiket berhasil dicabut.`,
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

  const handleOpenPromoteSingle = (tok: QrToken) => {
    setPromoteDivision(tok.member_division || '');
    setPromotingGuest({
      memberId: tok.member_id,
      memberName: tok.member_name || 'Peserta',
      externalId: tok.member_external_id || '',
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
          message: `Peserta "${promotingGuest.memberName}" berhasil diangkat menjadi anggota resmi organisasi! Riwayat absensi di kegiatan ini tetap tercatat utuh.`,
          type: 'success',
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Mengangkat Anggota',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pengangkatan anggota.',
        type: 'error',
      });
    } finally {
      setPromoteLoading(false);
    }
  };

  const attendanceBulkActions: BulkActionItem[] = isManager
    ? [
        {
          label: 'Hapus',
          icon: <Trash className="w-3.5 h-3.5" />,
          variant: 'danger' as const,
          onClick: handleBulkDeleteAttendances,
        },
      ]
    : [];

  const selectedGuestCount = qrTokens.filter(
    (t) => selectedTokenIds.has(t.id) && t.member_external_id?.startsWith('GUEST-')
  ).length;

  const selectedUnrevokedTokens = qrTokens.filter(
    (t) => selectedTokenIds.has(t.id) && !t.revoked_at
  );

  const tokenBulkActions: BulkActionItem[] = [
    ...(canGenerate
      ? [
          {
            label: 'Cetak QR',
            icon: <Printer className="w-3.5 h-3.5" />,
            variant: 'primary' as const,
            onClick: () => {
              const targetTokens = printableTokens.filter((t) => selectedTokenIds.has(t.id));
              if (targetTokens.length === 0) {
                setAlertModal({
                  isOpen: true,
                  title: 'Tidak Ada Tiket Valid Terpilih',
                  message: 'Tiket yang Anda pilih sudah dicabut (revoked), kedaluwarsa, atau tidak memiliki data QR valid.',
                  type: 'warning',
                });
                return;
              }
              setSelectedPrintTokens(targetTokens);
              setIsPrintSheetOpen(true);
            },
          },
        ]
      : []),
    ...(isManager && selectedGuestCount > 0
      ? [
          {
            label: 'Jadikan Anggota',
            icon: <UserCheck className="w-3.5 h-3.5" />,
            variant: 'primary' as const,
            onClick: handleOpenPromoteBulk,
          },
        ]
      : []),
    ...(isManager && selectedUnrevokedTokens.length > 0
      ? [
          {
            label: 'Cabut',
            icon: <ShieldWarning className="w-3.5 h-3.5" />,
            variant: 'warning' as const,
            onClick: handleBulkRevokeSelectedTokens,
          },
        ]
      : []),
    ...(isManager
      ? [
          {
            label: 'Hapus',
            icon: <Trash className="w-3.5 h-3.5" />,
            variant: 'danger' as const,
            onClick: handleBulkDeleteSelectedTokens,
          },
        ]
      : []),
  ];

  const handleExportAttendanceCsv = () => {
    if (!event) return;
    const params = new URLSearchParams();
    params.set('event_id', event.id);
    if (selectedDivision) params.set('division', selectedDivision);
    if (sessionFilter !== 'ALL') params.set('session_type', sessionFilter);
    params.set('format', 'csv');

    window.open(`/api/attendances/export?${params.toString()}`, '_blank');
  };

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] text-ink-2 space-y-3">
        <ArrowClockwise size={32} className="animate-spin text-ink-2" />
        <p className="text-sm font-semibold text-ink">Memuat Detail Kegiatan...</p>
      </div>
    );
  }

  const printableTokens = filterPrintableTokens(qrTokens, event.name);

  const isEventOnlyMode = event.qr_policy === 'event_only';

  // Metrics Calculations
  const activeMasterCount = members.filter((m) => m.status === 'active').length;
  const guestTokensCount = qrTokens.filter((t) => t.scope === 'event' && !t.revoked_at).length;
  const totalTargetMembers =
    event.qr_policy === 'universal_allowed'
      ? activeMasterCount + guestTokensCount
      : qrTokens.filter((t) => !t.revoked_at).length;

  const checkinAttendances = attendances.filter((a) => a.session_type === 'CHECKIN');
  const checkoutAttendances = attendances.filter((a) => a.session_type === 'CHECKOUT');
  const breakOutAttendances = attendances.filter((a) => a.session_type === 'BREAK_OUT');
  const breakInAttendances = attendances.filter((a) => a.session_type === 'BREAK_IN');

  const uniqueCheckins = new Set(checkinAttendances.map((a) => a.member_id)).size;
  const uniqueCheckouts = new Set(checkoutAttendances.map((a) => a.member_id)).size;

  const checkinPct = totalTargetMembers > 0 ? Math.round((uniqueCheckins / totalTargetMembers) * 100) : 0;
  const checkoutPct = totalTargetMembers > 0 ? Math.round((uniqueCheckouts / totalTargetMembers) * 100) : 0;

  // Filter attendances by sub-tab
  const displayedAttendances =
    sessionFilter === 'ALL'
      ? attendances
      : attendances.filter((a) => a.session_type === sessionFilter);

  return (
    <div className="space-y-6">

      {partialErrors.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-panel border border-pending-200 bg-pending-50/70 px-4 py-3 text-xs text-pending-800"
        >
          <Warning size={16} className="mt-0.5 shrink-0 text-pending-600" />
          <span>
            Sebagian data gagal dimuat: {partialErrors.join(', ')}. Angka di bawah
            mungkin tidak lengkap, bukan nol.
          </span>
        </div>
      )}
      {/* Header: title, status, and every event-level action live in one place. */}
      <EventHeaderSummary
        event={event}
        onBack={onBack}
        onRefresh={loadData}
        onScanEvent={onScanEvent}
        onOpenManualAttendance={() => setIsManualModalOpen(true)}
        onOpenPrintSheet={() => {
          setSelectedPrintTokens(null);
          setIsPrintSheetOpen(true);
        }}
        onExportAttendance={handleExportAttendanceCsv}
        onDeleteEvent={handleDeleteEvent}
        printableTokensCount={printableTokens.length}
        isManager={isManager}
        canExport={canExport}
      />

      <Tabs
        items={[
          { id: 'attendance', label: 'Daftar Hadir', badge: totalScanned },
          { id: 'qr', label: 'Tiket QR Event', badge: qrTokens.length },
          { id: 'overview', label: 'Ringkasan & Kebijakan' },
        ]}
        active={activeTab}
        onChange={(id: string) => setActiveTab(id as 'attendance' | 'qr' | 'overview')}
        variant="underline"
        ariaLabel="Bagian detail kegiatan"
      />
      {/* Attendance: the roster component owns search, filters, both view modes
          and the selection bar, so the page only supplies data and handlers. */}
      {activeTab === 'attendance' && (
        <AttendanceRosterTable
          attendances={attendances}
          displayedAttendances={displayedAttendances}
          totalScanned={totalScanned}
          sessionCounts={{
            checkin: uniqueCheckins,
            checkout: uniqueCheckouts,
            breakOut: breakOutAttendances.length,
            breakIn: breakInAttendances.length,
          }}
          sessionFilter={sessionFilter}
          onSelectSessionFilter={setSessionFilter}
          search={search}
          onSearchChange={setSearch}
          selectedDivision={selectedDivision}
          onDivisionChange={setSelectedDivision}
          divisions={divisions}
          mobileViewMode={mobileViewMode}
          onToggleMobileViewMode={setMobileViewMode}
          selectedAttendanceIds={selectedAttendanceIds}
          onToggleSelectAttendance={handleToggleSelectAttendance}
          onSelectAllAttendances={() => handleToggleSelectAllAttendances(displayedAttendances)}
          onDeleteAttendanceBatch={handleBulkDeleteAttendances}
          onClearSelection={handleClearAttendanceSelection}
          isManager={isManager}
          onOpenManualAttendance={() => setIsManualModalOpen(true)}
        />
      )}
      {/* QR passes: the workspace owns token selection, bulk actions and both
          the table and card views. */}
      {activeTab === 'qr' && (
        <GuestPassWorkspace
          event={event}
          qrTokens={qrTokens}
          selectedTokenIds={selectedTokenIds}
          onToggleSelectToken={handleToggleSelectToken}
          onSelectAllTokens={handleToggleSelectAllTokens}
          onOpenGuestModal={() => setIsGuestModalOpen(true)}
          onOpenQrModal={() => setIsQrModalOpen(true)}
          onOpenPrintSheet={() => {
            const targetTokens = filterPrintableTokens(qrTokens, event.name, selectedTokenIds);
            if (targetTokens.length === 0) {
              setAlertModal({
                isOpen: true,
                title: 'Tidak Ada Tiket Valid Terpilih',
                message:
                  'Tiket yang Anda pilih sudah dicabut (revoked), kedaluwarsa, atau tidak memiliki data QR valid.',
                type: 'warning',
              });
              return;
            }
            setSelectedPrintTokens(targetTokens);
            setIsPrintSheetOpen(true);
          }}
          onSelectTokenForCard={setSelectedTokenForCard}
          onOpenPromoteSingle={handleOpenPromoteSingle}
          onOpenPromoteBulk={handleOpenPromoteBulk}
          onRevokeToken={handleRevokeToken}
          onRevokeTokenBatch={handleBulkRevokeSelectedTokens}
          onDeleteToken={handleDeleteToken}
          onDeleteTokenBatch={handleBulkDeleteSelectedTokens}
          onClearSelection={handleClearTokenSelection}
          isManager={isManager}
          canGenerate={canGenerate}
        />
      )}
      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="surface space-y-4 rounded-panel p-6 shadow-ambient">
            <h3 className="font-heading text-base font-bold text-ink">Kebijakan Keamanan QR</h3>
            <div className="space-y-3 text-xs text-ink">
              <div className="rounded-panel border border-rule bg-paper-raised p-4">
                <p className="mb-1 flex items-center gap-1.5 font-bold text-ink-2">
                  {event.qr_policy === 'event_only' ? (
                    <ShieldWarning size={16} />
                  ) : (
                    <ShieldCheck size={16} className="text-seal-600" />
                  )}
                  <span>Mode: {event.qr_policy}</span>
                </p>
                <p className="text-ink-2">
                  {event.qr_policy === 'event_only'
                    ? 'Hanya menerima QR khusus event ini. QR Universal ditolak untuk memastikan tiket tidak disalahgunakan.'
                    : 'Mengizinkan tiket QR Universal yang belum kedaluwarsa atau tiket khusus event.'}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-chip border border-rule bg-paper-raised px-3 py-2.5">
                <span>Toleransi Waktu Absen (Grace Period)</span>
                <span className="font-oxanium font-bold tabular-nums text-ink">{event.grace_minutes} Menit</span>
              </div>

              <div className="flex items-center justify-between rounded-chip border border-rule bg-paper-raised px-3 py-2.5">
                <span>Absensi Manual</span>
                <span className="font-bold text-ink">
                  {event.allow_manual_attendance ? 'Diizinkan' : 'Dilarang'}
                </span>
              </div>
            </div>
          </div>

          <div className="surface space-y-4 rounded-panel p-6 shadow-ambient">
            <h3 className="font-heading text-base font-bold text-ink">Statistik Kehadiran</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="surface rounded-panel p-4">
                <span className="text-[10px] text-ink-2 uppercase font-semibold">Total Hadir</span>
                <p className="font-heading mt-1 text-3xl font-bold tabular-nums text-seal-800">{totalScanned}</p>
              </div>
              <div className="surface rounded-panel p-4">
                <span className="text-[10px] text-ink-2 uppercase font-semibold">Tiket Khusus Aktif</span>
                <p className="font-heading mt-1 text-3xl font-bold tabular-nums text-ink-2">{printableTokens.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Generator Modal (Existing Master Member - only when in event_only mode) */}
      <QrGeneratorModal
        isOpen={isQrModalOpen}
        onClose={() => {
          setIsQrModalOpen(false);
          loadData();
        }}
        preselectedEvent={event}
        members={members}
        events={events}
        divisions={divisions}
      />

      {/* Guest Pass Generator Modal (Temporary Participants) */}
      <GuestPassModal
        isOpen={isGuestModalOpen}
        onClose={() => {
          setIsGuestModalOpen(false);
          loadData();
        }}
        event={event}
        onSuccess={async (options?: { shouldPrint?: boolean }) => {
          await loadData();
          if (options?.shouldPrint !== false) {
            setSelectedPrintTokens(null);
            setIsPrintSheetOpen(true);
          }
        }}
      />

      {/* Bulk Print Sheet (Clean A4 Print Window) */}
      <PrintBadgeSheet
        isOpen={isPrintSheetOpen}
        onClose={() => {
          setIsPrintSheetOpen(false);
          setSelectedPrintTokens(null);
        }}
        tokens={selectedPrintTokens ?? printableTokens}
        eventName={event.name}
      />

      {/* Individual Digital Pass Card View Modal */}
      {selectedTokenForCard && selectedTokenForCard.qr_token && !selectedTokenForCard.revoked_at && (
        <ModalPortal onClose={() => setSelectedTokenForCard(null)}>
          <div className="modal-backdrop-full">
            <DigitalPassCard
              tokenString={selectedTokenForCard.qr_token}
              memberName={selectedTokenForCard.member_name || 'Peserta'}
              memberExternalId={selectedTokenForCard.member_external_id || selectedTokenForCard.member_id}
              memberDivision={selectedTokenForCard.member_division}
              eventName={event.name}
              scope={selectedTokenForCard.scope}
              expiresAt={selectedTokenForCard.expires_at}
              onClose={() => setSelectedTokenForCard(null)}
            />
          </div>
        </ModalPortal>
      )}

      {/* Manual attendance: only offered when the event policy allows it, and the
          form itself is a bezel panel inside the shared portal. */}
      {isManualModalOpen && (
        <ModalPortal onClose={() => setIsManualModalOpen(false)}>
          <div className="modal-backdrop-full">
            <form
              onSubmit={handleManualSubmit}
              className="bezel my-auto max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto p-5"
            >
              <h3 className="font-heading text-lg font-bold text-ink">Input Absensi Manual</h3>
              <p className="text-xs text-ink-2">
                Gunakan jika kamera bermasalah atau anggota hadir secara fisik tanpa tiket QR.
              </p>

              <Field
                id="event-detail-page-field-1"
                label="Pilih Anggota"
                control="select"
                required
                value={manualMemberId}
                onChange={setManualMemberId}
                options={[
                  { value: '', label: '-- Pilih Anggota --' },
                  ...members.map((m) => ({
                    value: m.id,
                    label: `${m.name} (${m.external_id}) ${m.division ? `- ${m.division}` : ''}`,
                  })),
                ]}
              />

              <Field
                id="event-detail-page-field-2"
                label="Pilih Sesi"
                control="select"
                required
                value={manualSessionType}
                onChange={(v) => setManualSessionType(v as SessionType)}
                options={[
                  { value: 'CHECKIN', label: 'CHECK-IN (Masuk)' },
                  { value: 'CHECKOUT', label: 'CHECK-OUT (Keluar)' },
                  { value: 'BREAK_OUT', label: 'BREAK OUT (Istirahat Keluar)' },
                  { value: 'BREAK_IN', label: 'BREAK IN (Istirahat Masuk)' },
                ]}
              />

              <Field
                id="event-detail-page-field-3"
                label="Alasan Pencatatan Manual"
                control="textarea"
                required
                hint="Tercatat di audit log alongside nama petugas."
                value={manualReason}
                onChange={setManualReason}
                placeholder="misal: Ponsel anggota mati / lupa membawa tiket QR fisik"
                controlClassName="min-h-[80px] text-xs"
              />

              <div className="flex items-center justify-end gap-3 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setIsManualModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={manualLoading}>
                  Catat Hadir Manual
                </Button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Promote Guest Modal */}
      {promotingGuest && (
        <ModalPortal onClose={() => setPromotingGuest(null)}>
          <div className="modal-backdrop-full">
            <div className="bezel my-auto max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto p-4 sm:p-6">
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-seal-50/60 text-seal-800">
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-ink">
                      Angkat Menjadi Anggota Resmi
                    </h3>
                    <p className="text-[11px] text-ink-2">
                      {promotingGuest.isBulk
                        ? `Memproses ${promotingGuest.bulkCount} peserta tamu`
                        : promotingGuest.memberName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPromotingGuest(null)}
                  aria-label="Tutup dialog angkat anggota"
                  className="touch-target rounded-chip p-1 text-ink-2 transition-colors hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1 rounded-panel border border-seal-200 bg-seal-50/70 p-3.5 text-xs text-seal-800">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle size={16} className="shrink-0 text-seal-600" />
                  <span>Riwayat Presensi Tetap Tersimpan Utuh</span>
                </p>
                <p className="text-ink text-[11px] leading-relaxed">
                  Peserta akan diberikan <strong>ID Anggota resmi baru</strong> dan <strong>QR Universal permanen</strong>. Presensi pada kegiatan penerimaan ini otomatis diakui dan terhitung di Pelacak Keaktifan.
                </p>
              </div>

              <div className="space-y-2">
                <Field
                  id="event-detail-page-field-4"
                  label="Pilih Divisi (Opsional)"
                  control="select"
                  value={promoteDivision}
                  onChange={setPromoteDivision}
                  controlClassName="border-0 bg-transparent px-0 text-xs focus-visible:ring-0"
                  leadingIcon={<Buildings className="h-4 w-4" />}
                  options={[
                    { value: '', label: '-- Tanpa Divisi / Pilih Nanti --' },
                    ...divisions.map((div) => ({ value: div, label: div })),
                  ]}
                />
                <p className="text-[10px] text-ink-2">
                  Email dan nomor HP dapat dilengkapi atau diedit manual kapan saja di menu Master Anggota.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-rule pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPromotingGuest(null)}
                  disabled={promoteLoading}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmPromote}
                  loading={promoteLoading}
                  icon={<UserCheck size={14} />}
                >
                  Ya, Angkat Jadi Anggota
                </Button>
              </div>
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

      {/* Contextual Floating Action Button for Mobile Viewport */}
      {event.status === 'active' && onScanEvent && (
        <div className="fixed bottom-24 right-4 z-bar md:hidden">
          <button
            type="button"
            onClick={() => onScanEvent(event)}
            className="flex h-12 items-center gap-2 rounded-chip bg-pen-500 px-4 text-xs font-bold text-paper shadow-lift transition-transform duration-120 ease-spring active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper hover:bg-pen-400"
            aria-label="Scan Presensi"
          >
            <QrCode size={16} />
            <span>Scan Presensi</span>
          </button>
        </div>
      )}
    </div>
  );
};
