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
} from 'lucide-react';
import { Event } from '@/shared/types';
import { SkeletonEventList } from '../ui/Skeleton';

interface EventListProps {
  events: Event[];
  loading?: boolean;
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
      <div className="glass-panel rounded-3xl p-10 text-center border border-slate-800 animate-in fade-in duration-200">
        <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-bold text-slate-300">Belum ada kegiatan yang dibuat</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Silakan buat kegiatan baru untuk mulai mengatur absensi QR.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: Event['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Aktif
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
            Draft
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950/60 text-rose-400 border border-rose-800/40">
            Selesai / Tutup
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {events.map((event) => {
        const isSelected = selectedIds?.has(event.id);
        return (
          <div
            key={event.id}
            className={`glass-panel-elevated rounded-3xl p-5 border shadow-lg flex flex-col justify-between transition-all group ${
              isSelected ? 'border-sky-500/80 bg-sky-950/20 shadow-sky-500/10' : 'border-slate-800/80 hover:border-slate-700'
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
                <div className="shrink-0">{getStatusBadge(event.status)}</div>
              </div>

            {/* QR Policy Badge */}
            <div className="flex items-center gap-2">
              {event.qr_policy === 'event_only' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-sky-950/80 text-sky-400 border border-sky-800/40">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>QR Khusus Event</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>QR Universal Bebas</span>
                </span>
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
          <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800/60">
            <div className="flex items-center gap-1">
              {canManage ? (
                <>
                  {event.status === 'draft' && (
                    <button
                      onClick={() => onActivateEvent(event.id)}
                      title="Aktifkan Event"
                      className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Aktifkan</span>
                    </button>
                  )}
                  {event.status === 'active' && (
                    <button
                      onClick={() => onCloseEvent(event.id)}
                      title="Tutup Event"
                      className="p-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Tutup</span>
                    </button>
                  )}
                  <button
                    onClick={() => onEditEvent(event)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
                    title="Edit Event"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteEvent(event.id, event.name)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="Hapus Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-500 italic">Mode Read-Only</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {event.status === 'active' && onScanEvent && (
                <button
                  type="button"
                  onClick={() => onScanEvent(event)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all"
                  title="Buka Pemindai QR untuk Kegiatan Ini"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectEvent(event)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all"
              >
                <span>Detail</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    })}
    </div>
  );
};
