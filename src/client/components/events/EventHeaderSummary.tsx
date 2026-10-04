import React from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Building2,
  RefreshCw,
  Plus,
  Printer,
  Download,
  Trash2,
  QrCode,
} from 'lucide-react';
import { Event } from '@/shared/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { eventStatusVariant } from '../../lib/event-status';

export interface EventHeaderSummaryProps {
  event: Event | null;
  onBack: () => void;
  onRefresh?: () => void;
  onScanEvent?: (event: Event) => void;
  onOpenManualAttendance: () => void;
  onOpenPrintSheet: () => void;
  onExportAttendance: () => void;
  onDeleteEvent: () => void;
  printableTokensCount: number;
  isManager: boolean;
  canExport: boolean;
}

export const EventHeaderSummary: React.FC<EventHeaderSummaryProps> = ({
  event,
  onBack,
  onRefresh,
  onScanEvent,
  onOpenManualAttendance,
  onOpenPrintSheet,
  onExportAttendance,
  onDeleteEvent,
  printableTokensCount,
  isManager,
  canExport,
}) => {
  if (!event) return null;

  return (
    <div className="space-y-4">
      {/* Top Navigation Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            title="Kembali ke Daftar Kegiatan"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">{event.name}</h1>
              <Badge variant={eventStatusVariant(event.status)}>
                {event.status === 'active' ? 'AKTIF' : event.status === 'closed' ? 'SELESAI' : 'DRAFT'}
              </Badge>
            </div>
            {event.description && <p className="text-xs text-slate-400 mt-0.5">{event.description}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onRefresh}
              title="Perbarui Data"
            >
              Refresh
            </Button>
          )}

          {isManager && (
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={onOpenManualAttendance}
              title="Input Presensi Manual"
            >
              Presensi Manual
            </Button>
          )}

          {printableTokensCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={onOpenPrintSheet}
              title="Cetak Tiket QR / Name Tag"
            >
              Cetak Tiket ({printableTokensCount})
            </Button>
          )}

          {canExport && (
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={onExportAttendance}
              title="Ekspor CSV Presensi"
            >
              Ekspor CSV
            </Button>
          )}

          {isManager && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={onDeleteEvent}
              title="Hapus Kegiatan"
            >
              Hapus
            </Button>
          )}

          {event.status === 'active' && onScanEvent && (
            <Button
              variant="primary"
              size="sm"
              icon={<QrCode className="w-3.5 h-3.5" />}
              onClick={() => onScanEvent(event)}
              className="hidden md:inline-flex"
            >
              Buka Scanner
            </Button>
          )}
        </div>
      </div>

      {/* Event Details Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl glass-panel border border-slate-800/80 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Waktu Mulai</span>
            <span>{event.starts_at ? new Date(event.starts_at).toLocaleString('id-ID') : 'Tidak ditentukan'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-slate-300">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Waktu Selesai & Toleransi</span>
            <span>
              {event.ends_at ? new Date(event.ends_at).toLocaleString('id-ID') : 'Fleksibel'} (+{event.grace_minutes || 30}m)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-slate-300">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Lokasi</span>
            <span className="truncate max-w-[180px]">{event.location_name || 'Lokasi Kegiatan'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-slate-300">
          {event.qr_policy === 'event_only' ? (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          )}
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Kebijakan QR</span>
            <span>
              {event.qr_policy === 'event_only'
                ? 'Hanya Tiket Khusus Event'
                : 'ID Universal & Tiket Khusus'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
