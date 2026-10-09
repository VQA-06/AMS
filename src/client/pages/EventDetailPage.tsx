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
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { PartialBanner } from '../components/ui/PartialBanner';
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
import { ConvertGuestModal, ConvertGuestItem } from '../components/members/ConvertGuestModal';
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

  const [convertCandidateGuests, setConvertCandidateGuests] = useState<ConvertGuestItem[] | null>(null);


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

  const handleOpenConvertCandidateSingle = (tok: QrToken) => {
    setConvertCandidateGuests([
      {
        id: tok.member_id,
        name: tok.member_name || 'Peserta Tamu',
        external_id: tok.member_external_id || undefined,
        division: tok.member_division || undefined,
      },
    ]);
  };

  const handleOpenConvertCandidateBulk = () => {
    const selectedTokens = qrTokens.filter(
      (t) =>
        selectedTokenIds.has(t.id) &&
        (t.member_external_id?.startsWith('GUEST-') ||
          (t.note && t.note.toLowerCase().includes('guest')) ||
          (t.note && t.note.toLowerCase().includes('tamu')) ||
          t.scope === 'event')
    );
    if (selectedTokens.length === 0) {
      setAlertModal({
        isOpen: true,
        title: 'Tidak Ada Tamu Terpilih',
        message: 'Pilih minimal satu tiket peserta tamu untuk dimigrasikan ke calon anggota.',
        type: 'warning',
      });
      return;
    }
    setConvertCandidateGuests(
      selectedTokens.map((t) => ({
        id: t.member_id,
        name: t.member_name || 'Peserta Tamu',
        external_id: t.member_external_id || undefined,
        division: t.member_division || undefined,
      }))
    );
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
            label: 'Jadikan Calon Anggota',
            icon: <UserPlus className="w-3.5 h-3.5" />,
            variant: 'primary' as const,
            onClick: handleOpenConvertCandidateBulk,
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
    <div className="space-y-6 pb-24 md:pb-8">

      <PartialBanner sections={partialErrors} />
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
          { id: 'attendance', label: 'Daftar Hadir' },
          { id: 'qr', label: 'Tiket QR Event' },
          { id: 'overview', label: 'Kebijakan' },
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
          onOpenConvertCandidateSingle={handleOpenConvertCandidateSingle}
          onOpenConvertCandidateBulk={handleOpenConvertCandidateBulk}
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
          <div className="surface space-y-4 rounded-panel p-6">
            <h2 className="font-heading text-base font-bold text-ink">Kebijakan Keamanan QR</h2>
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

          <div className="surface space-y-4 rounded-panel p-6">
            <h2 className="font-heading text-base font-bold text-ink">Statistik Kehadiran</h2>
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
              className="surface bezel my-auto max-h-[86dvh] w-full max-w-md space-y-3 sm:space-y-4 overflow-y-auto p-4 sm:p-5"
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


      {/* Convert Guest to Candidate Modal */}
      <ConvertGuestModal
        isOpen={Boolean(convertCandidateGuests)}
        onClose={() => setConvertCandidateGuests(null)}
        selectedGuests={convertCandidateGuests || []}
        divisionList={divisions}
        onSuccess={() => {
          handleClearTokenSelection();
          loadData();
          onRefresh?.();
        }}
      />

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
        <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-fab md:hidden">
          <button
            type="button"
            onClick={() => onScanEvent(event)}
            className="flex h-12 items-center gap-2 rounded-chip bg-pen-500 px-4 text-xs font-bold text-paper shadow-lift transition-transform duration-120 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper hover:bg-pen-400"
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
