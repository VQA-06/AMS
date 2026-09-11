import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Plus, RefreshCw, Search, Filter, X, LayoutGrid, LayoutList } from 'lucide-react';
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
import { Button } from '../components/ui/Button';

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
  const [loading, setLoading] = useState<boolean>(true);

  // View Mode: Grid (cards) default for mobile/smartphone (< 768px), Table for desktop workstation (>= 768px)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem(isMobile ? 'ams_event_view_mode_mobile' : 'ams_event_view_mode_desktop');
      if (saved === 'table' || saved === 'grid') {
        return saved;
      }
      return isMobile ? 'grid' : 'table';
    }
    return 'grid';
  });

  const handleSetViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    try {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      localStorage.setItem(isMobile ? 'ams_event_view_mode_mobile' : 'ams_event_view_mode_desktop', mode);
    } catch {
      // Safe fallback if localStorage is restricted
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const isMobile = e.matches;
      const saved = localStorage.getItem(isMobile ? 'ams_event_view_mode_mobile' : 'ams_event_view_mode_desktop');
      if (saved === 'table' || saved === 'grid') {
        setViewMode(saved);
      } else {
        setViewMode(isMobile ? 'grid' : 'table');
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  // Search and Filter
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'closed'>('all');

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

    // Listen for realtime mutation events across tabs and modals
    const handleMutation = () => {
      loadEvents(true);
    };

    window.addEventListener('ams:data-mutated', handleMutation);
    return () => {
      window.removeEventListener('ams:data-mutated', handleMutation);
    };
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

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter !== 'all' && ev.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = ev.name.toLowerCase().includes(q);
        const matchLoc = ev.location_name?.toLowerCase().includes(q);
        const matchDesc = ev.description?.toLowerCase().includes(q);
        return matchName || matchLoc || matchDesc;
      }
      return true;
    });
  }, [events, search, statusFilter]);

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all';

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-white flex items-center gap-2.5">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400" />
            <span>Manajemen Kegiatan / Event</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Atur jadwal, status kegiatan, dan kebijakan QR (event-only atau universal)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isManager && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-400">
              Mode Read-Only
            </span>
          )}

          {isManager && (
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingEvent(null);
                setIsFormOpen(true);
              }}
            >
              Buat Kegiatan Baru
            </Button>
          )}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => loadEvents(true)}
            title="Segarkan Data Kegiatan"
            aria-label="Segarkan Data Kegiatan"
          >
            <RefreshCw className={`w-4 h-4 text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Unified Command Toolbar */}
      <div className="glass-panel p-2.5 sm:p-3 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            aria-label="Cari kegiatan berdasarkan nama, lokasi, atau deskripsi"
            placeholder="Cari kegiatan atau lokasi..."
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
          {/* Status Filter */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'draft' | 'closed')}
              aria-label="Filter status kegiatan"
              className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-medium text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Semua Status</option>
              <option value="active" className="bg-slate-900">Sedang Aktif</option>
              <option value="draft" className="bg-slate-900">Draft</option>
              <option value="closed" className="bg-slate-900">Selesai / Tutup</option>
            </select>
            <Filter className="w-3 h-3 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* View Mode Toggle: Table vs Grid */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800/80 rounded-xl p-0.5 shrink-0" role="group" aria-label="Pilihan tampilan data">
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilan Tabel Workstation"
              aria-label="Tampilan Tabel Workstation"
              aria-pressed={viewMode === 'table'}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilan Kartu Grid"
              aria-label="Tampilan Kartu Grid"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              aria-label="Reset semua filter"
              className="px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:text-white hover:bg-rose-900/60 text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Event List */}
      <EventList
        events={filteredEvents}
        loading={loading}
        viewMode={viewMode}
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
