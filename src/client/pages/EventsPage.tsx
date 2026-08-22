import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, RefreshCw } from 'lucide-react';
import { Event } from '@/shared/types';
import { EventInput } from '@/shared/schemas/event.schema';
import { fetchApi } from '../lib/api-client';
import { fetchCached, invalidateCache } from '../lib/swr-client';
import { useAuth } from '../hooks/useAuth';
import { canManageEvents } from '../lib/permissions';
import { EventList } from '../components/events/EventList';
import { EventFormModal } from '../components/events/EventFormModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';

import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';
import { CheckCircle, Trash2 } from 'lucide-react';

interface EventsPageProps {
  onSelectEvent: (event: Event) => void;
  onScanEvent?: (event: Event) => void;
  openCreateModalTrigger?: boolean;
  onResetCreateModalTrigger?: () => void;
  onEventCreated?: () => void;
  onRefreshGlobal?: () => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({
  onSelectEvent,
  onScanEvent,
  openCreateModalTrigger,
  onResetCreateModalTrigger,
  onEventCreated,
  onRefreshGlobal,
}) => {
  const { admin } = useAuth();
  const isManager = canManageEvents(admin?.role);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Multi-Select state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

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

  const loadEvents = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const res = await fetchCached<{ events: Event[] }>('/api/agenda', { forceRefresh: force, ttlMs: 30_000 });
      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (openCreateModalTrigger) {
      setEditingEvent(null);
      setIsFormOpen(true);
      onResetCreateModalTrigger?.();
    }
  }, [openCreateModalTrigger, onResetCreateModalTrigger]);

  const handleToggleSelect = (id: string) => {
    setSelectedEventIds((prev) => {
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
    if (selectedEventIds.size === events.length && events.length > 0) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(events.map((e) => e.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedEventIds(new Set());
  };

  const handleBulkCloseSelected = () => {
    const ids = Array.from(selectedEventIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Tutup ${ids.length} Kegiatan`,
      message: (
        <span>
          Apakah Anda yakin ingin menutup <strong>{ids.length} kegiatan</strong> yang dipilih? Scanner tidak akan
          lagi menerima absensi baru untuk kegiatan tersebut.
        </span>
      ),
      type: 'warning',
      confirmText: 'Tutup Kegiatan',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/agenda/bulk-close', {
            method: 'POST',
            body: JSON.stringify({ ids }),
          });
          invalidateCache('/api/agenda');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedEventIds(new Set());
          await loadEvents(true);
          onRefreshGlobal?.();
        } catch (err) {
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menutup Kegiatan',
            message: err instanceof Error ? err.message : 'Gagal menutup kegiatan.',
            type: 'error',
          });
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleBulkDeleteSelected = () => {
    const ids = Array.from(selectedEventIds);
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Hapus Permanen ${ids.length} Kegiatan`,
      message: (
        <span>
          Tindakan ini <strong>tidak dapat dibatalkan</strong>. Seluruh riwayat presensi dan data anggota
          sementara/tamu yang dibuat khusus untuk <strong>{ids.length} kegiatan</strong> ini akan ikut terhapus permanen.
        </span>
      ),
      type: 'danger',
      confirmText: 'Hapus Permanen',
      onConfirm: async () => {
        try {
          setConfirmLoading(true);
          await fetchApi('/api/agenda/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids }),
          });
          invalidateCache('/api/agenda');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedEventIds(new Set());
          await loadEvents(true);
          onRefreshGlobal?.();
        } catch (err) {
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

  const bulkActions: BulkActionItem[] = isManager
    ? [
        {
          label: 'Tutup',
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          variant: 'warning' as const,
          onClick: handleBulkCloseSelected,
        },
        {
          label: 'Hapus',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          variant: 'danger' as const,
          onClick: handleBulkDeleteSelected,
        },
      ]
    : [];

  const handleSaveEvent = async (data: EventInput) => {
    if (editingEvent) {
      await fetchApi(`/api/agenda/${editingEvent.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } else {
      await fetchApi('/api/agenda', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
    invalidateCache('/api/agenda');
    await loadEvents(true);
    onEventCreated?.();
    onRefreshGlobal?.();
  };

  const handleActivate = async (id: string) => {
    try {
      await fetchApi(`/api/agenda/${id}/activate`, { method: 'POST' });
      invalidateCache('/api/agenda');
      await loadEvents(true);
      onRefreshGlobal?.();
      setAlertModal({
        isOpen: true,
        title: 'Kegiatan Diaktifkan',
        message: 'Kegiatan berhasil diaktifkan. Scanner dan presensi kini dapat digunakan.',
        type: 'success',
      });
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Gagal Mengaktifkan',
        message: err instanceof Error ? err.message : 'Gagal mengaktifkan event.',
        type: 'error',
      });
    }
  };

  const handleClose = (id: string, name?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Tutup Kegiatan',
      message: (
        <span>
          Yakin ingin menutup kegiatan <strong>"{name || 'ini'}"</strong>? Absensi baru tidak akan diizinkan setelah kegiatan ditutup.
        </span>
      ),
      type: 'warning',
      confirmText: 'Ya, Tutup Kegiatan',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/agenda/${id}/close`, { method: 'POST' });
          invalidateCache('/api/agenda');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadEvents(true);
          onRefreshGlobal?.();
          setAlertModal({
            isOpen: true,
            title: 'Kegiatan Ditutup',
            message: 'Kegiatan berhasil ditutup.',
            type: 'info',
          });
        } catch (err) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setAlertModal({
            isOpen: true,
            title: 'Gagal Menutup Kegiatan',
            message: err instanceof Error ? err.message : 'Gagal menutup event.',
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
      title: 'Hapus Kegiatan Permanen',
      message: (
        <span>
          Yakin ingin <strong>MENGHAPUS PERMANEN</strong> kegiatan <strong className="text-white">"{name}"</strong> beserta seluruh riwayat absensi dan tiketnya?
        </span>
      ),
      type: 'danger',
      confirmText: 'Ya, Hapus Permanen',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await fetchApi(`/api/agenda/${id}`, { method: 'DELETE' });
          invalidateCache('/api/agenda');
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadEvents(true);
          onRefreshGlobal?.();
          setAlertModal({
            isOpen: true,
            title: 'Kegiatan Dihapus',
            message: `Kegiatan "${name}" berhasil dihapus permanen.`,
            type: 'success',
          });
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

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-sky-400" />
            <span>Manajemen Kegiatan / Event</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Atur jadwal, status kegiatan, dan kebijakan QR (event-only atau universal)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isManager && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-400">
              Mode Read-Only
            </span>
          )}

          {isManager && (
            <button
              onClick={() => {
                setEditingEvent(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Kegiatan Baru</span>
            </button>
          )}
          <button
            onClick={() => loadEvents(true)}
            className="p-2.5 glass-panel text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Event List */}
      <EventList
        events={events}
        loading={loading}
        canManage={isManager}
        selectedIds={selectedEventIds}
        onToggleSelect={handleToggleSelect}
        onSelectEvent={onSelectEvent}
        onScanEvent={onScanEvent}
        onEditEvent={(ev) => {
          setEditingEvent(ev);
          setIsFormOpen(true);
        }}
        onActivateEvent={handleActivate}
        onCloseEvent={handleClose}
        onDeleteEvent={handleDelete}
      />

      {/* Contextual Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedEventIds.size}
        totalCount={events.length}
        itemLabel="Kegiatan"
        onClearSelection={handleClearSelection}
        onSelectAll={handleToggleSelectAll}
        isAllSelected={events.length > 0 && selectedEventIds.size === events.length}
        actions={bulkActions}
      />

      {/* Modal */}
      <EventFormModal
        isOpen={isFormOpen}
        event={editingEvent}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEvent}
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
    </div>
  );
};
