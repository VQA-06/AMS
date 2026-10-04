import React from 'react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { CaretRight } from '@phosphor-icons/react/CaretRight';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Clock } from '@phosphor-icons/react/Clock';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Play } from '@phosphor-icons/react/Play';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { ShieldWarning } from '@phosphor-icons/react/ShieldWarning';
import { Trash } from '@phosphor-icons/react/Trash';
import { Event } from '@/shared/types';
import { SkeletonEventList } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, markFillClass, type MarkTone } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Table, THead, TBody, TRow, TCell } from '../ui/Table';
import { cn } from '../../lib/cn';

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

/** The one focus quartet on every hand-rolled control in this file. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/**
 * Status is the reason the mark exists here: it varies per row, so the mark
 * carries presence/absence instead of a per-row badge repeating the same word.
 * `draft` is pending (ochre), `active` is live (jade), `closed` is terminal
 * (danger), everything else — `archived`, anything the server adds later — is
 * neutral `idle`.
 */
function eventStatusMark(status: Event['status']): MarkTone {
  if (status === 'active') return 'seal';
  if (status === 'draft') return 'pending';
  if (status === 'closed') return 'danger';
  return 'idle';
}

/** Readable Indonesian status label, used only where the text *is* the message. */
function statusLabel(status: Event['status']): string {
  if (status === 'active') return 'Aktif';
  if (status === 'draft') return 'Draft';
  if (status === 'closed') return 'Selesai / Tutup';
  return status;
}

const checkboxClass = cn(
  'h-4 w-4 cursor-pointer rounded border-rule-strong bg-paper accent-pen-500',
  focusRing
);

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
        icon={<CalendarBlank className="h-8 w-8 text-ink-2" />}
        title="Belum ada kegiatan yang dibuat"
        description="Buat kegiatan baru untuk mulai mengaktifkan presensi QR terenkripsi dan pass digital panitia."
      />
    );
  }

  const selectCell = (event: Event, isSelected: boolean, extraClass?: string) =>
    onToggleSelect ? (
      <TCell className={cn('w-10 text-center', extraClass)}>
        <input
          type="checkbox"
          checked={isSelected || false}
          onChange={() => onToggleSelect(event.id)}
          className={checkboxClass}
          aria-label={`Pilih kegiatan ${event.name}`}
        />
      </TCell>
    ) : null;

  if (viewMode === 'table') {
    return (
      <div className="surface overflow-hidden rounded-panel shadow-ambient">
        <Table className="min-w-[700px]">
          <THead>
            <tr>
              {onToggleSelect && (
                <TCell header className="w-10 text-center">
                  <span className="sr-only">Pilih</span>
                </TCell>
              )}
              <TCell header>Nama Kegiatan &amp; Lokasi</TCell>
              <TCell header>Kebijakan QR</TCell>
              <TCell header>Waktu Mulai</TCell>
              <TCell header className="text-center">Status</TCell>
              <TCell header className="text-right">Aksi</TCell>
            </tr>
          </THead>
          <TBody>
            {events.map((event) => {
              const isSelected = selectedIds?.has(event.id) ?? false;
              return (
                <TRow key={event.id} selected={isSelected} className="group" mark={eventStatusMark(event.status)}>
                  {selectCell(event, isSelected)}

                  {/* The mark is on the row itself; this cell just carries the
                      identity that the mark colour is read against. */}
                  <TCell truncate>

                    <div className="truncate font-heading text-sm font-bold text-ink">
                      {event.name}
                    </div>
                    {event.location_name && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-2">
                        <MapPin className="h-3 w-3 shrink-0 text-ink-2" />
                        <span className="truncate">{event.location_name}</span>
                      </div>
                    )}
                    {event.description && (
                      <div className="mt-0.5 truncate text-[11px] text-ink-2">
                        {event.description}
                      </div>
                    )}
                  </TCell>

                  <TCell className="whitespace-nowrap">
                    {event.qr_policy === 'event_only' ? (
                      <Badge variant="pen" size="sm" icon={<ShieldWarning className="h-3.5 w-3.5" />}>
                        QR Khusus Event
                      </Badge>
                    ) : (
                      <Badge variant="seal" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                        QR Universal Bebas
                      </Badge>
                    )}
                  </TCell>

                  <TCell className="whitespace-nowrap font-oxanium text-[11px] text-ink">
                    {event.starts_at ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-ink-2" />
                        <span>
                          {new Date(event.starts_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-ink-3">-</span>
                    )}
                  </TCell>

                  <TCell className="text-center">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                      {statusLabel(event.status)}
                    </span>
                  </TCell>

                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {event.status === 'active' && onScanEvent && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<QrCode className="h-3.5 w-3.5" />}
                          onClick={() => onScanEvent(event)}
                          aria-label={`Buka kamera pemindai untuk ${event.name}`}
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
                              className={cn(
                                'flex h-8 items-center gap-1 rounded-chip bg-seal-50/60 px-2.5 text-xs font-semibold text-seal-800 transition-colors hover:bg-seal-50/70',
                                focusRing
                              )}
                            >
                              <Play className="h-3.5 w-3.5" />
                              <span>Aktifkan</span>
                            </button>
                          )}
                          {event.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => onCloseEvent(event.id)}
                              title="Tutup Event"
                              aria-label={`Tutup event ${event.name}`}
                              className={cn(
                                'flex h-8 items-center gap-1 rounded-chip bg-pending-50/60 px-2.5 text-xs font-semibold text-pending-800 transition-colors hover:bg-pending-50/70',
                                focusRing
                              )}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>Tutup</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditEvent(event)}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-chip text-ink-2 transition-colors hover:bg-paper-raised hover:text-ink',
                              focusRing
                            )}
                            title="Edit Event"
                            aria-label={`Edit ${event.name}`}
                          >
                            <PencilSimple className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEvent(event.id, event.name)}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-chip text-ink-2 transition-colors hover:bg-pen-50/70 hover:text-pen-deep',
                              focusRing
                            )}
                            title="Hapus Event"
                            aria-label={`Hapus ${event.name}`}
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </TCell>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => {
        const isSelected = selectedIds?.has(event.id) ?? false;
        return (
          <Card
            key={event.id}
            mark={eventStatusMark(event.status)}
            className={cn(
              'group flex flex-col p-5 transition-colors',
              isSelected ? 'shadow-lift ring-1 ring-pen-400/40' : undefined
            )}
          >
            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  {onToggleSelect && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(event.id)}
                      className={cn(checkboxClass, 'mt-1 shrink-0')}
                      aria-label={`Pilih kegiatan ${event.name}`}
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-heading text-base font-bold text-ink">
                      {event.name}
                    </h3>
                    {event.location_name && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-2" />
                        <span className="truncate">{event.location_name}</span>
                      </p>
                    )}
                  </div>
                </div>
                {/* No status badge: the mark already encodes it, and the status
                    word would only repeat it. */}
              </div>

              <div className="mt-3 flex items-center gap-2">
                {event.qr_policy === 'event_only' ? (
                  <Badge variant="pen" size="sm" icon={<ShieldWarning className="h-3.5 w-3.5" />}>
                    QR Khusus Event
                  </Badge>
                ) : (
                  <Badge variant="seal" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                    QR Universal Bebas
                  </Badge>
                )}
              </div>

              {(event.starts_at || event.ends_at) && (
                <div className="mt-3 space-y-0.5 border-t border-rule pt-2 font-oxanium text-[11px] text-ink-2">
                  {event.starts_at && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-ink-2" />
                      <span>
                        Mulai:{' '}
                        {new Date(event.starts_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
                <div className="flex items-center gap-1">
                  {canManage ? (
                    <>
                      {event.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => onActivateEvent(event.id)}
                          title="Aktifkan Event"
                          aria-label={`Aktifkan event ${event.name}`}
                          className={cn(
                            'flex min-h-[40px] items-center gap-1.5 rounded-chip bg-seal-50/60 px-3 text-xs font-semibold text-seal-800 transition-colors hover:bg-seal-50/70',
                            focusRing
                          )}
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Aktifkan</span>
                        </button>
                      )}
                      {event.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => onCloseEvent(event.id)}
                          title="Tutup Event"
                          aria-label={`Tutup event ${event.name}`}
                          className={cn(
                            'flex min-h-[40px] items-center gap-1.5 rounded-chip bg-pending-50/60 px-3 text-xs font-semibold text-pending-800 transition-colors hover:bg-pending-50/70',
                            focusRing
                          )}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Tutup</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditEvent(event)}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-chip text-ink-2 transition-colors hover:bg-paper-raised hover:text-ink',
                          focusRing
                        )}
                        title="Edit Event"
                        aria-label={`Edit ${event.name}`}
                      >
                        <PencilSimple className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(event.id, event.name)}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-chip text-ink-2 transition-colors hover:bg-pen-50/70 hover:text-pen-deep',
                          focusRing
                        )}
                        title="Hapus Event"
                        aria-label={`Hapus ${event.name}`}
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] italic text-ink-2">Mode Read-Only</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {event.status === 'active' && onScanEvent && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<QrCode className="h-3.5 w-3.5" />}
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
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};