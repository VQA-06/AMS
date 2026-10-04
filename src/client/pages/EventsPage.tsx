import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { FunnelSimple } from '@phosphor-icons/react/FunnelSimple';
import { ListBullets } from '@phosphor-icons/react/ListBullets';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/Plus';
import { SquaresFour } from '@phosphor-icons/react/SquaresFour';
import { Trash } from '@phosphor-icons/react/Trash';
import { Warning } from '@phosphor-icons/react/Warning';
import { X } from '@phosphor-icons/react/X';
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
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';

import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';
import { cn } from '../lib/cn';

/** The one focus quartet on every hand-rolled control in this file. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

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

  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  const loadEvents = useCallback(async (force = false) => {
    setLoading(true);
    // A failed agenda fetch must never render as an empty list that reads like
    // "there are no events"; it raises the banner instead.
    const [res] = await Promise.allSettled([
      fetchCached<{ events: Event[] }>('/api/agenda', { forceRefresh: force, ttlMs: 30_000 }),
    ]);
    if (res.status === 'fulfilled') {
      setEvents(res.value.events || []);
      setLoadFailed(false);
    } else {
      console.error('Failed to load events:', res.reason);
      setLoadFailed(true);
    }
    setLoading(false);
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
          icon: <Trash className="w-3.5 h-3.5" />,
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
          Yakin ingin <strong>MENGHAPUS PERMANEN</strong> kegiatan <strong className="text-ink">"{name}"</strong> beserta seluruh riwayat absensi dan tiketnya?
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
    <div className="space-y-5 pb-20 md:space-y-8">
      <PageHeader
        title="Manajemen Kegiatan / Event"
        subtitle="Atur jadwal, status kegiatan, dan kebijakan QR (event-only atau universal)"
        actions={
          <>
            {!isManager && (
              <span className="rounded-chip border border-rule-strong bg-paper px-3 py-1.5 text-xs font-semibold text-ink-2">
                Mode Read-Only
              </span>
            )}

            {isManager && (
              <Button
                variant="primary"
                size="md"
                icon={<Plus className="h-4 w-4" />}
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
              <ArrowClockwise className={cn('h-4 w-4 text-ink', loading && 'animate-spin')} />
            </Button>
          </>
        }
      />

      {loadFailed && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-panel border border-pending-200 bg-pending-50/70 px-4 py-3 text-xs text-pending-800"
        >
          <Warning className="h-4 w-4 shrink-0 text-pending-600" />
          <span>
            Daftar kegiatan gagal dimuat. Daftar di bawah mungkin tidak lengkap, bukan kosong.
          </span>
        </div>
      )}

      {/* Unified Command Toolbar */}
      <div className="surface flex flex-col items-stretch justify-between gap-2.5 rounded-panel p-2.5 sm:p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
          <label htmlFor="events-page-field-1" className="sr-only">
            Cari kegiatan berdasarkan nama, lokasi, atau deskripsi
          </label>
          <input
            id="events-page-field-1"
            type="text"
            placeholder="Cari kegiatan atau lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full rounded-panel border border-rule bg-ink/80 py-2 pl-9 pr-8 text-xs text-paper transition-colors placeholder:text-ink-2',
              focusRing
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Hapus teks pencarian"
              className={cn(
                'absolute right-2.5 top-1/2 -translate-y-1/2 rounded-chip p-1 text-ink-2 transition-colors hover:text-ink',
                focusRing
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {/* Status Filter */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <label htmlFor="events-page-field-2" className="sr-only">
              Filter status kegiatan
            </label>
            <select
              id="events-page-field-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'draft' | 'closed')}
              className={cn(
                'w-full cursor-pointer appearance-none rounded-panel border border-rule bg-ink/80 px-3 py-2 text-xs font-medium text-ink transition-colors',
                focusRing
              )}
            >
              <option value="all" className="bg-paper">Semua Status</option>
              <option value="active" className="bg-paper">Sedang Aktif</option>
              <option value="draft" className="bg-paper">Draft</option>
              <option value="closed" className="bg-paper">Selesai / Tutup</option>
            </select>
            <FunnelSimple className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-2" />
          </div>

          {/* View Mode Toggle: Table vs Grid */}
          <div
            className="flex shrink-0 items-center rounded-panel border border-rule bg-ink/80 p-0.5"
            role="group"
            aria-label="Pilihan tampilan data"
          >
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={cn(
                'rounded-chip p-1.5 text-xs font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-paper-raised text-ink-2'
                  : 'text-ink-2 hover:text-ink',
                focusRing
              )}
              title="Tampilan Tabel Workstation"
              aria-label="Tampilan Tabel Workstation"
              aria-pressed={viewMode === 'table'}
            >
              <ListBullets className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={cn(
                'rounded-chip p-1.5 text-xs font-medium transition-colors',
                viewMode === 'grid'
                  ? 'bg-paper-raised text-ink-2'
                  : 'text-ink-2 hover:text-ink',
                focusRing
              )}
              title="Tampilan Kartu Grid"
              aria-label="Tampilan Kartu Grid"
              aria-pressed={viewMode === 'grid'}
            >
              <SquaresFour className="w-4 h-4" />
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
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-chip border border-pen-200 bg-pen-50/70 px-3 py-2 text-xs font-semibold text-pen-deep transition-colors hover:bg-pen-50/70 hover:text-ink',
                focusRing
              )}
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
