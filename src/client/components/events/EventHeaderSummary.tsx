import React from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { ArrowLeft } from '@phosphor-icons/react/ArrowLeft';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { Clock } from '@phosphor-icons/react/Clock';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { Plus } from '@phosphor-icons/react/Plus';
import { Printer } from '@phosphor-icons/react/Printer';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { ShieldWarning } from '@phosphor-icons/react/ShieldWarning';
import { Trash } from '@phosphor-icons/react/Trash';
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
            className="touch-target rounded-chip border border-rule-strong bg-paper-raised text-ink-2 transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper hover:bg-paper hover:text-ink"
            aria-label="Kembali ke Daftar Kegiatan"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-ink">{event.name}</h1>
              <Badge variant={eventStatusVariant(event.status)}>
                {event.status === 'active' ? 'AKTIF' : event.status === 'closed' ? 'SELESAI' : 'DRAFT'}
              </Badge>
            </div>
            {event.description && <p className="text-xs text-ink-2 mt-0.5">{event.description}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowClockwise size={14} />}
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
              icon={<Plus size={14} />}
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
              icon={<Printer size={14} />}
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
              icon={<DownloadSimple size={14} />}
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
              icon={<Trash size={14} />}
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
              icon={<QrCode size={14} />}
              onClick={() => onScanEvent(event)}
              className="hidden md:inline-flex"
            >
              Buka Scanner
            </Button>
          )}
        </div>
      </div>

      {/* Event Details Ribbon */}
      <div className="surface grid grid-cols-1 gap-3 rounded-panel p-4 text-xs shadow-ambient sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-2.5 text-ink">
          <CalendarBlank size={16} className="shrink-0 text-ink-2" />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-2">Waktu Mulai</span>
            <span>{event.starts_at ? new Date(event.starts_at).toLocaleString('id-ID') : 'Tidak ditentukan'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-ink">
          <Clock size={16} className="shrink-0 text-pending-600" />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-2">Waktu Selesai & Toleransi</span>
            <span>
              {event.ends_at ? new Date(event.ends_at).toLocaleString('id-ID') : 'Fleksibel'} (+{event.grace_minutes || 30}m)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-ink">
          <MapPin size={16} className="shrink-0 text-seal-600" />
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-2">Lokasi</span>
            <span className="block truncate max-w-[180px]">{event.location_name || 'Lokasi Kegiatan'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-ink">
          {event.qr_policy === 'event_only' ? (
            <ShieldWarning size={16} className="shrink-0 text-pending-600" />
          ) : (
            <ShieldCheck size={16} className="shrink-0 text-seal-600" />
          )}
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-2">Kebijakan QR</span>
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
