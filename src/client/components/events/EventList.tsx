import React from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Play,
  CheckCircle,
  Edit2,
  Trash2,
  ChevronRight,
  QrCode,
  Plus,
} from 'lucide-react';
import { Event } from '@/shared/types';
import { SkeletonEventList } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { eventStatusVariant } from '../../lib/event-status';

interface EventListProps {
  events: Event[];
  loading?: boolean;
  viewMode?: 'table' | 'grid';
  onSelectEvent: (event: Event) => void;
  onScanEvent?: (event: Event) => void;
  onEditEvent: (event: Event) => void;
  onActivateEvent: (id: string) => void;
  onCloseEvent: (id: string) => void;
  onDeleteEvent: (id: string, name: string) => void;
  canManage?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export const EventList: React.FC<EventListProps> = ({
  events,
  loading = false,
  viewMode = 'grid',
  onSelectEvent,
  onScanEvent,
  onEditEvent,
  onActivateEvent,
  onCloseEvent,
  onDeleteEvent,
  canManage = true,
  selectedIds,
  onToggleSelect,
}) => {
  // Show smooth skeleton shimmer placeholders while events are loading
  if (loading) {
    return <SkeletonEventList count={4} />;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="w-8 h-8 text-sky-400" />}
        title="Belum ada kegiatan yang dibuat"
        description="Buat kegiatan baru untuk mulai mengaktifkan presensi QR terenkripsi dan pass digital panitia."
      />
    );
  }

  const renderStatusBadge = (status: Event['status']) => {
    const variant = eventStatusVariant(status);
    const label =
      status === 'active'
        ? 'Aktif'
        : status === 'draft'
        ? 'Draft'
        : status === 'closed'
        ? 'Selesai / Tutup'
        : status;

    return (
      <Badge variant={variant} size="sm" pulse={status === 'active'}>
        {label}
      </Badge>
    );
  };

  if (viewMode === 'table') {
    return (
      <div className="glass-panel border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/90 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {onToggleSelect && (
                  <th className="py-3 px-4 w-10 text-center">
                    <span className="sr-only">Pilih</span>
                  </th>
                )}
                <th className="py-3 px-4">Nama Kegiatan & Lokasi</th>
                <th className="py-3 px-4">Kebijakan QR</th>
                <th className="py-3 px-4">Waktu Mulai</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {events.map((event) => {
                const isSelected = selectedIds?.has(event.id);
                return (
                  <tr
                    key={event.id}
                    className={`group transition-colors ${
                      isSelected
                        ? 'bg-sky-950/25 hover:bg-sky-950/35'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {onToggleSelect && (
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={() => onToggleSelect(event.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                          aria-label={`Pilih kegiatan ${event.name}`}
                        />
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      <div className="font-heading font-bold text-sm text-white group-hover:text-sky-400 transition-colors">
                        {event.name}
                      </div>
                      {event.location_name && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{event.location_name}</span>
                        </div>
                      )}
                      {event.description && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md mt-0.5">
                          {event.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {event.qr_policy === 'event_only' ? (
                        <Badge variant="sky" size="sm" icon={<ShieldAlert className="w-3.5 h-3.5" />}>
                          QR Khusus Event
                        </Badge>
                      ) : (
                        <Badge variant="emerald" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                          QR Universal Bebas
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                      {event.starts_at ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{new Date(event.starts_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-center">
                      {renderStatusBadge(event.status)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {event.status === 'active' && onScanEvent && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<QrCode className="w-3.5 h-3.5" />}
                            onClick={() => onScanEvent(event)}
                            aria-label={`Scan QR untuk ${event.name}`}
                          >
                            Scan
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectEvent(event)}
                          aria-label={`Detail ${event.name}`}
                        >
                          Detail
                        </Button>

                        {canManage && (
                          <>
                            {event.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => onActivateEvent(event.id)}
                                title="Aktifkan Event"
                                aria-label={`Aktifkan event ${event.name}`}
                                className="h-8 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Aktifkan</span>
                              </button>
                            )}
                            {event.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => onCloseEvent(event.id)}
                                title="Tutup Event"
                                aria-label={`Tutup event ${event.name}`}
                                className="h-8 px-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Tutup</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditEvent(event)}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Event"
                              aria-label={`Edit ${event.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEvent(event.id, event.name)}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Hapus Event"
                              aria-label={`Hapus ${event.name}`}
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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {events.map((event) => {
        const isSelected = selectedIds?.has(event.id);
        return (
          <div
            key={event.id}
            className={`glass-panel-interactive rounded-3xl p-5 border shadow-lg flex flex-col justify-between group ${
              isSelected
                ? 'border-sky-500/80 bg-sky-950/20 shadow-sky-500/10'
                : 'border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  {onToggleSelect && (
                    <input
                      type="checkbox"
                      checked={isSelected || false}
                      onChange={() => onToggleSelect(event.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500 shrink-0"
                      aria-label={`Pilih kegiatan ${event.name}`}
                    />
                  )}
                  <div>
                    <h4 className="font-heading font-bold text-base text-white group-hover:text-sky-400 transition-colors">
                      {event.name}
                    </h4>
                    {event.location_name && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{event.location_name}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0">{renderStatusBadge(event.status)}</div>
              </div>

              {/* QR Policy Badge */}
              <div className="flex items-center gap-2">
                {event.qr_policy === 'event_only' ? (
                  <Badge variant="sky" size="sm" icon={<ShieldAlert className="w-3.5 h-3.5" />}>
                    QR Khusus Event
                  </Badge>
                ) : (
                  <Badge variant="emerald" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                    QR Universal Bebas
                  </Badge>
                )}
              </div>

              {/* Timestamps */}
              {(event.starts_at || event.ends_at) && (
                <div className="text-[11px] text-slate-400 space-y-0.5 pt-2 border-t border-slate-800/60 font-mono">
                  {event.starts_at && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Mulai: {new Date(event.starts_at).toLocaleString('id-ID')}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Row */}
            <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800/60 gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {canManage ? (
                  <>
                    {event.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => onActivateEvent(event.id)}
                        title="Aktifkan Event"
                        aria-label={`Aktifkan event ${event.name}`}
                        className="min-h-[40px] px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Aktifkan</span>
                      </button>
                    )}
                    {event.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => onCloseEvent(event.id)}
                        title="Tutup Event"
                        aria-label={`Tutup event ${event.name}`}
                        className="min-h-[40px] px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Tutup</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditEvent(event)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      title="Edit Event"
                      aria-label={`Edit ${event.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteEvent(event.id, event.name)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      title="Hapus Event"
                      aria-label={`Hapus ${event.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Mode Read-Only</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {event.status === 'active' && onScanEvent && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<QrCode className="w-3.5 h-3.5" />}
                    onClick={() => onScanEvent(event)}
                    aria-label={`Buka kamera pemindai untuk ${event.name}`}
                  >
                    Scan QR
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onSelectEvent(event)}
                  aria-label={`Buka detail kegiatan ${event.name}`}
                >
                  <span>Detail</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
