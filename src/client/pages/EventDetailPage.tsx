import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  ShieldAlert,
  ShieldCheck,
  QrCode,
  Users,
  Download,
  Plus,
  ArrowLeft,
  RefreshCw,
  Building2,
  CheckCircle,
  LogOut,
  LogIn,
  Coffee,
  Printer,
  Eye,
  UserPlus,
  X,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Event, Attendance, QrToken, Member, SessionType } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { canManageEvents, canExportData, canGenerateQR } from '../lib/permissions';
import { QrGeneratorModal } from '../components/qr/QrGeneratorModal';
import { PrintBadgeSheet, PrintableToken } from '../components/qr/PrintBadgeSheet';
import { GuestPassModal } from '../components/events/GuestPassModal';
import { DigitalPassCard } from '../components/qr/DigitalPassCard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';
import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';

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

      const [attRes, qrRes, sumRes] = await Promise.all([
        fetchApi<{ attendances: Attendance[]; total: number }>(
          `/api/attendances/event/${eventId}?${params.toString()}`
        ).catch(() => ({ attendances: [], total: 0 })),
        fetchApi<{ tokens: QrToken[] }>(`/api/qr/event/${eventId}`).catch(() => ({ tokens: [] })),
        fetchApi<{ event: Event; total_scanned: number; total_tokens: number }>(
          `/api/events/${eventId}/summary`
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
          await fetchApi(`/api/qr/${id}`, { method: 'DELETE' });
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
          Yakin ingin <strong>MENGHAPUS PERMANEN</strong> kegiatan <strong className="text-white">"{event.name}"</strong> beserta seluruh riwayat data absensi dan tiketnya?
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Hapus Permanen',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/events/${event.id}`, { method: 'DELETE' });
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
          for (const id of ids) {
            await fetchApi(`/api/qr/${id}`, { method: 'DELETE' });
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
          icon: <Trash2 className="w-3.5 h-3.5" />,
          variant: 'danger' as const,
          onClick: handleBulkDeleteAttendances,
        },
      ]
    : [];

  const selectedGuestCount = qrTokens.filter(
    (t) => selectedTokenIds.has(t.id) && t.member_external_id?.startsWith('GUEST-')
  ).length;

  const tokenBulkActions: BulkActionItem[] = [
    ...(canGenerate
      ? [
          {
            label: 'Cetak QR',
            icon: <Printer className="w-3.5 h-3.5" />,
            variant: 'primary' as const,
            onClick: () => setIsPrintSheetOpen(true),
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
    ...(isManager
      ? [
          {
            label: 'Hapus',
            icon: <Trash2 className="w-3.5 h-3.5" />,
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
      <div className="flex flex-col items-center justify-center min-h-[350px] text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-semibold text-slate-300">Memuat Detail Kegiatan...</p>
      </div>
    );
  }

  // Only active, unrevoked tokens are printable
  const printableTokens: PrintableToken[] = qrTokens
    .filter(
      (tok) =>
        !tok.revoked_at &&
        new Date(tok.expires_at).getTime() > Date.now() &&
        Boolean(tok.qr_token)
    )
    .map((tok) => ({
      id: tok.id,
      member_id: tok.member_id,
      member_name: tok.member_name || 'Peserta',
      member_external_id: tok.member_external_id || tok.member_id,
      member_division: tok.member_division || null,
      qr_token: tok.qr_token || '',
      scope: tok.scope,
      expires_at: tok.expires_at,
      event_name: event.name,
    }));

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
    <div className="space-y-6 animate-in fade-in">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl glass-panel text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-2xl font-bold font-heading text-white">{event.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              {event.location_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{event.location_name}</span>
                </span>
              )}
              <span className="font-mono text-sky-400 font-bold uppercase">{event.status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {event.status === 'active' && onScanEvent && (
            <button
              type="button"
              onClick={() => onScanEvent(event)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              title="Buka Pemindai QR untuk kegiatan ini"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR Presensi</span>
            </button>
          )}

          {/* Delete Event Action */}
          {isManager && (
            <button
              onClick={handleDeleteEvent}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 transition-colors"
              title="Hapus kegiatan beserta data terkait"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Hapus Kegiatan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'attendance'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar Hadir ({totalScanned})</span>
        </button>

        <button
          onClick={() => setActiveTab('qr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'qr'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Tiket QR Event ({qrTokens.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'overview'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Ringkasan & Kebijakan</span>
        </button>
      </div>

      {/* Tab Content: Attendance List */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* KPI Attendance Metrics Card Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Target Total Members */}
            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold">
                Target Peserta
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-heading text-white">
                  {totalTargetMembers}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {event.qr_policy === 'universal_allowed' ? 'Master + Tamu' : 'Khusus'}
                </span>
              </div>
            </div>

            {/* Check-In Progress */}
            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-emerald-300 uppercase font-semibold flex items-center gap-1">
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Check-In</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-400 font-mono">
                  {checkinPct}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-heading text-emerald-400">
                  {uniqueCheckins}
                </span>
                <span className="text-xs text-slate-400 font-semibold">/ {totalTargetMembers}</span>
              </div>
            </div>

            {/* Check-Out Progress */}
            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-sky-900/40 bg-sky-950/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-sky-300 uppercase font-semibold flex items-center gap-1">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Check-Out</span>
                </span>
                <span className="text-[11px] font-bold text-sky-400 font-mono">
                  {checkoutPct}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-heading text-sky-400">
                  {uniqueCheckouts}
                </span>
                <span className="text-xs text-slate-400 font-semibold">/ {totalTargetMembers}</span>
              </div>
            </div>

            {/* Break Sessions */}
            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-amber-900/40 bg-amber-950/20 flex flex-col justify-between">
              <span className="text-[10px] sm:text-xs text-amber-300 uppercase font-semibold flex items-center gap-1">
                <Coffee className="w-3.5 h-3.5" />
                <span>Istirahat</span>
              </span>
              <div className="mt-2 flex items-baseline justify-between text-xs text-slate-300">
                <span className="font-bold text-amber-400 text-lg">
                  {breakOutAttendances.length}{' '}
                  <span className="text-xs text-slate-400 font-normal">Keluar</span>
                </span>
                <span className="font-bold text-amber-400 text-lg">
                  {breakInAttendances.length}{' '}
                  <span className="text-xs text-slate-400 font-normal">Masuk</span>
                </span>
              </div>
            </div>
          </div>

          {/* Session Sub-Tabs & Action Bar */}
          <div className="space-y-3">
            {/* Session Sub-Tabs Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 overflow-x-auto">
              <button
                onClick={() => setSessionFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sessionFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({attendances.length})
              </button>

              <button
                onClick={() => setSessionFilter('CHECKIN')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sessionFilter === 'CHECKIN'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                Check-In ({checkinAttendances.length})
              </button>

              <button
                onClick={() => setSessionFilter('CHECKOUT')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sessionFilter === 'CHECKOUT'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'text-slate-400 hover:text-sky-400'
                }`}
              >
                Check-Out ({checkoutAttendances.length})
              </button>

              <button
                onClick={() => setSessionFilter('BREAK_OUT')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sessionFilter === 'BREAK_OUT'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                    : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                Break-Out ({breakOutAttendances.length})
              </button>

              <button
                onClick={() => setSessionFilter('BREAK_IN')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  sessionFilter === 'BREAK_IN'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-400 hover:text-purple-400'
                }`}
              >
                Break-In ({breakInAttendances.length})
              </button>
            </div>

            {/* Search, Division & Actions */}
            <div className="glass-panel-elevated rounded-2xl p-3 sm:p-4 border border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama / ID peserta..."
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-60"
                />

                {divisions.length > 0 && (
                  <div className="flex items-center gap-1.5 glass-panel px-3 py-1.5 rounded-xl text-xs">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    <select
                      value={selectedDivision}
                      onChange={(e) => setSelectedDivision(e.target.value)}
                      className="bg-transparent text-slate-200 focus:outline-none text-xs"
                    >
                      <option value="" className="bg-slate-900">Semua Divisi</option>
                      {divisions.map((div, i) => (
                        <option key={i} value={div} className="bg-slate-900">
                          {div}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {isManager && Boolean(event.allow_manual_attendance) && (
                  <button
                    onClick={() => setIsManualModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-panel text-slate-200 hover:text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4 text-sky-400" />
                    <span>Absen Manual</span>
                  </button>
                )}

                {canExport && (
                  <button
                    onClick={handleExportAttendanceCsv}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-panel text-slate-200 hover:text-white text-xs font-semibold shadow"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    <span>Export CSV</span>
                  </button>
                )}

                <button
                  onClick={loadData}
                  className="p-2 glass-panel text-slate-400 hover:text-white rounded-xl transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {displayedAttendances.length === 0 ? (
            <div className="glass-panel rounded-3xl p-10 text-center border border-slate-800">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">
                {sessionFilter === 'ALL'
                  ? 'Belum ada data kehadiran'
                  : `Belum ada data untuk sesi ${sessionFilter}`}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan scanner QR untuk mulai memindai tiket anggota.
              </p>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800 shadow-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    {isManager && (
                      <th className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={displayedAttendances.length > 0 && selectedAttendanceIds.size === displayedAttendances.length}
                          onChange={() => handleToggleSelectAllAttendances(displayedAttendances)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                          title={selectedAttendanceIds.size === displayedAttendances.length ? 'Batalkan pilih semua' : 'Pilih semua'}
                        />
                      </th>
                    )}
                    <th className="px-5 py-3.5">ID Anggota</th>
                    <th className="px-5 py-3.5">Nama</th>
                    <th className="px-5 py-3.5">Divisi</th>
                    <th className="px-5 py-3.5">Sesi</th>
                    <th className="px-5 py-3.5">Waktu Scan</th>
                    <th className="px-5 py-3.5">Operator</th>
                    <th className="px-5 py-3.5">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayedAttendances.map((att) => {
                    const sessionBadgeColor =
                      att.session_type === 'CHECKIN'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50'
                        : att.session_type === 'CHECKOUT'
                        ? 'bg-sky-950/80 text-sky-400 border-sky-800/50'
                        : att.session_type === 'BREAK_OUT'
                        ? 'bg-amber-950/80 text-amber-400 border-amber-800/50'
                        : 'bg-purple-950/80 text-purple-400 border-purple-800/50';

                    const isSelected = selectedAttendanceIds.has(att.id);

                    return (
                      <tr
                        key={att.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-sky-950/20 hover:bg-sky-950/30' : 'hover:bg-slate-900/40'
                        }`}
                      >
                        {isManager && (
                          <td className="w-10 px-4 py-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectAttendance(att.id)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                            />
                          </td>
                        )}
                        <td className="px-5 py-3.5 font-bold text-sky-400">{att.member_external_id}</td>
                        <td className="px-5 py-3.5 font-sans font-semibold text-white">{att.member_name}</td>
                        <td className="px-5 py-3.5 font-sans">
                          {att.member_division ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40 text-[11px] font-semibold">
                              <Building2 className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>{att.member_division}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${sessionBadgeColor}`}
                          >
                            {att.session_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {new Date(att.scanned_at).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 font-sans text-slate-300">{att.operator_name || '-'}</td>
                        <td className="px-5 py-3.5 font-sans">
                          {att.is_manual ? (
                            <span className="text-amber-400 font-semibold">Manual</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">Scan QR</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Contextual Floating Bulk Action Bar for Attendances */}
          <BulkActionBar
            selectedCount={selectedAttendanceIds.size}
            totalCount={displayedAttendances.length}
            itemLabel="Presensi"
            onClearSelection={handleClearAttendanceSelection}
            onSelectAll={() => handleToggleSelectAllAttendances(displayedAttendances)}
            isAllSelected={displayedAttendances.length > 0 && selectedAttendanceIds.size === displayedAttendances.length}
            actions={attendanceBulkActions}
          />
        </div>
      )}

      {/* Tab Content: Event QR Tokens */}
      {activeTab === 'qr' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
            <div>
              <h3 className="font-heading font-bold text-base text-white">Tiket QR Khusus Event</h3>
              <p className="text-xs text-slate-400">
                {!isEventOnlyMode
                  ? 'Kegiatan ini menerima QR Universal. Anda dapat menambahkan tiket khusus untuk peserta tamu sementara.'
                  : 'Mode QR Khusus: Hanya menerima tiket khusus yang dibuat untuk event ini.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isManager && (
                <>
                  <button
                    onClick={() => setIsGuestModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Peserta Tamu</span>
                  </button>

                  {/* Only show "+ Anggota Master" when event_only policy is active */}
                  {isEventOnlyMode && (
                    <button
                      onClick={() => setIsQrModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Anggota Master</span>
                    </button>
                  )}
                </>
              )}

              {canGenerate && printableTokens.length > 0 && (
                <button
                  onClick={() => setIsPrintSheetOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 glass-panel text-slate-200 hover:text-white text-xs font-semibold rounded-xl shadow"
                >
                  <Printer className="w-4 h-4 text-sky-400" />
                  <span>Cetak Lembar Tiket ({printableTokens.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Tokens Table */}
          {qrTokens.length === 0 ? (
            <div className="glass-panel rounded-3xl p-10 text-center border border-slate-800 space-y-3">
              <QrCode className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                Belum ada tiket QR khusus yang dibuat untuk event ini
              </p>
              {!isEventOnlyMode && (
                <p className="text-xs text-emerald-400/80 mt-1 max-w-md mx-auto">
                  Anggota master dapat langsung memindai QR Universal mereka saat hadir.
                </p>
              )}
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setIsGuestModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-semibold"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Tamu Sementara</span>
                </button>
                {isEventOnlyMode && (
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pilih dari Master Anggota</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800 shadow-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={qrTokens.length > 0 && selectedTokenIds.size === qrTokens.length}
                        onChange={handleToggleSelectAllTokens}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                        title={selectedTokenIds.size === qrTokens.length ? 'Batalkan pilih semua' : 'Pilih semua'}
                      />
                    </th>
                    <th className="px-5 py-3.5">ID Peserta</th>
                    <th className="px-5 py-3.5">Nama</th>
                    <th className="px-5 py-3.5">Divisi</th>
                    <th className="px-5 py-3.5">Masa Berlaku</th>
                    <th className="px-5 py-3.5">Status Tiket</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {qrTokens.map((tok) => {
                    const isExpired = new Date(tok.expires_at).getTime() < Date.now();
                    const isRevoked = Boolean(tok.revoked_at);
                    const isSelected = selectedTokenIds.has(tok.id);

                    return (
                      <tr
                        key={tok.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-sky-950/20 hover:bg-sky-950/30' : 'hover:bg-slate-900/40'
                        }`}
                      >
                        <td className="w-10 px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectToken(tok.id)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                          />
                        </td>
                        <td className="px-5 py-3.5 font-bold text-sky-400">{tok.member_external_id}</td>
                        <td className="px-5 py-3.5 font-sans font-semibold text-white">{tok.member_name}</td>
                        <td className="px-5 py-3.5 font-sans">
                          {tok.member_division ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40 text-[11px] font-semibold">
                              <Building2 className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>{tok.member_division}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {tok.scope === 'universal' || new Date(tok.expires_at).getFullYear() >= 2090
                            ? 'Permanen (Status Aktif)'
                            : new Date(tok.expires_at).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 font-sans">
                          {isRevoked ? (
                            <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/50 text-[10px] font-bold">
                              Dicabut (Revoked)
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                              Kedaluwarsa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[10px] font-bold">
                              Aktif ({tok.uses_count}/{tok.max_uses || '∞'})
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            {tok.qr_token && !isRevoked && (
                              <button
                                onClick={() => setSelectedTokenForCard(tok)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-sky-400 hover:bg-sky-950/50 rounded-lg transition-colors font-semibold"
                                title="Lihat kartu atau cetak"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </button>
                            )}

                            {isManager && tok.member_external_id?.startsWith('GUEST-') && !isRevoked && (
                              <button
                                onClick={() => handleOpenPromoteSingle(tok)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-lg transition-all font-semibold shadow-sm active:scale-95"
                                title="Jadikan Anggota Resmi Organisasi"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Angkat Resmi</span>
                              </button>
                            )}

                            {isManager && (
                              <>
                                {!isRevoked && (
                                  <button
                                    onClick={() => handleRevokeToken(tok.id)}
                                    className="px-2 py-1 text-xs text-amber-400 hover:bg-amber-950/40 rounded-lg transition-colors font-semibold"
                                    title="Cabut masa berlaku tiket"
                                  >
                                    Cabut
                                  </button>
                                )}

                                <button
                                  onClick={() => handleDeleteToken(tok.id, tok.member_name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                                  title="Hapus tiket dari event"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Contextual Floating Bulk Action Bar for Tokens */}
          <BulkActionBar
            selectedCount={selectedTokenIds.size}
            totalCount={qrTokens.length}
            itemLabel="Tiket"
            onClearSelection={handleClearTokenSelection}
            onSelectAll={handleToggleSelectAllTokens}
            isAllSelected={qrTokens.length > 0 && selectedTokenIds.size === qrTokens.length}
            actions={tokenBulkActions}
          />
        </div>
      )}

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel-elevated rounded-3xl p-6 border border-slate-800 space-y-4">
            <h3 className="font-heading font-bold text-base text-white">Kebijakan Keamanan QR</h3>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <p className="font-bold text-sky-400 flex items-center gap-1.5 mb-1">
                  {event.qr_policy === 'event_only' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Mode: {event.qr_policy}</span>
                </p>
                <p className="text-slate-400">
                  {event.qr_policy === 'event_only'
                    ? 'Hanya menerima QR khusus event ini. QR Universal ditolak untuk memastikan tiket tidak disalahgunakan.'
                    : 'Mengizinkan tiket QR Universal yang belum kedaluwarsa atau tiket khusus event.'}
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl glass-panel">
                <span>Toleransi Waktu Absen (Grace Period)</span>
                <span className="font-bold text-white font-mono">{event.grace_minutes} Menit</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl glass-panel">
                <span>Absensi Manual</span>
                <span className="font-bold text-white">
                  {event.allow_manual_attendance ? 'Diizinkan' : 'Dilarang'}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-panel-elevated rounded-3xl p-6 border border-slate-800 space-y-4">
            <h3 className="font-heading font-bold text-base text-white">Statistik Kehadiran</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Hadir</span>
                <p className="text-3xl font-bold font-heading text-emerald-400 mt-1">{totalScanned}</p>
              </div>
              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Tiket Khusus Aktif</span>
                <p className="text-3xl font-bold font-heading text-sky-400 mt-1">{printableTokens.length}</p>
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
        onSuccess={async () => {
          await loadData();
          setIsPrintSheetOpen(true);
        }}
      />

      {/* Bulk Print Sheet (Clean A4 Print Window) */}
      <PrintBadgeSheet
        isOpen={isPrintSheetOpen}
        onClose={() => setIsPrintSheetOpen(false)}
        tokens={printableTokens}
        eventName={event.name}
      />

      {/* Individual Digital Pass Card View Modal */}
      {selectedTokenForCard && selectedTokenForCard.qr_token && !selectedTokenForCard.revoked_at && (
        <div className="modal-backdrop-full animate-in fade-in">
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
      )}

      {/* Manual Attendance Modal */}
      {isManualModalOpen && (
        <div className="modal-backdrop-full animate-in fade-in">
          <form
            onSubmit={handleManualSubmit}
            className="w-full max-w-md rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-6 space-y-4"
          >
            <h3 className="font-heading font-bold text-lg text-white">Input Absensi Manual</h3>
            <p className="text-xs text-slate-400">
              Gunakan jika kamera bermasalah atau anggota hadir secara fisik tanpa tiket QR.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Pilih Anggota:</label>
              <select
                required
                value={manualMemberId}
                onChange={(e) => setManualMemberId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">-- Pilih Anggota --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.external_id}) {m.division ? `- ${m.division}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Pilih Sesi:</label>
              <select
                value={manualSessionType}
                onChange={(e) => setManualSessionType(e.target.value as SessionType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="CHECKIN">CHECK-IN (Masuk)</option>
                <option value="CHECKOUT">CHECK-OUT (Keluar)</option>
                <option value="BREAK_OUT">BREAK OUT (Istirahat Keluar)</option>
                <option value="BREAK_IN">BREAK IN (Istirahat Masuk)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Alasan Pencatatan Manual <span className="text-rose-400">*</span>:
              </label>
              <textarea
                required
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="misal: Ponsel anggota mati / lupa membawa tiket QR fisik"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 min-h-[80px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={manualLoading}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20"
              >
                {manualLoading ? 'Menyimpan...' : 'Catat Hadir Manual'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Promote Guest Modal */}
      {promotingGuest && (
        <div className="modal-backdrop-full animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-white">
                    Angkat Menjadi Anggota Resmi
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {promotingGuest.isBulk
                      ? `Memproses ${promotingGuest.bulkCount} peserta tamu`
                      : promotingGuest.memberName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPromotingGuest(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Riwayat Presensi Tetap Tersimpan Utuh</span>
              </p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Peserta akan diberikan <strong>ID Anggota resmi baru</strong> dan <strong>QR Universal permanen</strong>. Presensi pada kegiatan penerimaan ini otomatis diakui dan terhitung di Pelacak Keaktifan.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Pilih Divisi (Opsional):
              </label>
              <div className="flex items-center gap-2 glass-panel p-2.5 rounded-xl border border-slate-800">
                <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
                <select
                  value={promoteDivision}
                  onChange={(e) => setPromoteDivision(e.target.value)}
                  className="w-full bg-transparent text-xs text-white focus:outline-none"
                >
                  <option value="" className="bg-slate-900">-- Tanpa Divisi / Pilih Nanti --</option>
                  {divisions.map((div, i) => (
                    <option key={i} value={div} className="bg-slate-900">
                      {div}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-500">
                Email dan nomor HP dapat dilengkapi atau diedit manual kapan saja di menu Master Anggota.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPromotingGuest(null)}
                disabled={promoteLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmPromote}
                disabled={promoteLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <UserCheck className="w-4 h-4" />
                <span>{promoteLoading ? 'Memproses...' : 'Ya, Angkat Jadi Anggota'}</span>
              </button>
            </div>
          </div>
        </div>
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
