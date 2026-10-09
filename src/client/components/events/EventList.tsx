import React from 'react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { Eye } from '@phosphor-icons/react/Eye';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Play } from '@phosphor-icons/react/Play';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { Trash } from '@phosphor-icons/react/Trash';
import { Stop } from '@phosphor-icons/react/Stop';
import { Event } from '@/shared/types';
import { SkeletonEventList } from '../ui/Skeleton';
import { RowList, type RowListItem } from '../ui/RowList';
import { EmptyState } from '../ui/EmptyState';
import { RowActions, type RowActionItem } from '../ui/RowActions';
import { cn } from '../../lib/cn';

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
  onToggleSelectAll?: () => void;
}

/** The one focus quartet on every hand-rolled control in this file. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const iconButtonClass = (tone: 'pen' | 'neutral' | 'danger' | 'seal') =>
  cn(
    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-chip transition-colors duration-120 ease-out-expo',
    focusRing,
    tone === 'pen' && 'text-pen-deep hover:bg-pen-50/70',
    tone === 'neutral' && 'text-ink-2 hover:bg-paper-sunk hover:text-ink',
    tone === 'danger' && 'text-ink-2 hover:bg-pending-50 hover:text-pending-700',
    tone === 'seal' && 'text-seal-800 hover:bg-seal-50/70'
  );

/**
 * Status is the reason the mark exists here: it varies per row, so the mark
 * carries presence/absence instead of a per-row badge repeating the same word.
 * `draft` is pending (ochre), `active` is live (jade), `closed` is terminal
 * (danger), everything else — `archived`, anything the server adds later — is
 * neutral `idle`.
 */
function eventStatusTone(status: Event['status']): 'seal' | 'pending' | 'danger' | 'idle' {
  if (status === 'active') return 'seal';
  if (status === 'draft') return 'pending';
  if (status === 'closed') return 'danger';
  return 'idle';
}

/** Readable Indonesian status label. The mark carries the hue; this the word. */
function statusLabel(status: Event['status']): string {
  if (status === 'active') return 'Aktif';
  if (status === 'draft') return 'Draft';
  if (status === 'closed') return 'Selesai';
  return status;
}

/**
 * `qr_policy` decides whether a scan validates against the event roster or
 * against every member — the single most consequential thing to know before
 * opening the camera, so it rides the row rather than hiding in the detail view.
 */
function qrPolicyLabel(event: Event): string {
  return event.qr_policy === 'event_only' ? 'QR Khusus Event' : 'QR Universal Bebas';
}

/** Starts-at is the sort key operators read first; absent means unscheduled. */
function startsAtLabel(event: Event): string | undefined {
  if (!event.starts_at) return undefined;
  return new Date(event.starts_at).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
  onToggleSelectAll,
}) => {
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

  const items: RowListItem[] = events.map((event) => {
    const menuItems: RowActionItem[] = [];
    if (event.status === 'active' && onScanEvent) {
      menuItems.push({
        label: `Buka kamera pemindai untuk`,
        icon: <QrCode className="h-4 w-4" />,
        onSelect: () => onScanEvent(event),
      });
    }
    menuItems.push({
      label: `Detail`,
      icon: <Eye className="h-4 w-4" />,
      onSelect: () => onSelectEvent(event),
    });
    if (canManage) {
      if (event.status === 'draft') {
        menuItems.push({
          label: `Aktifkan event`,
          icon: <Play className="h-4 w-4" />,
          onSelect: () => onActivateEvent(event.id),
        });
      }
      if (event.status === 'active') {
        menuItems.push({
          label: `Tutup event`,
          icon: <Stop className="h-4 w-4" />,
          onSelect: () => onCloseEvent(event.id),
        });
      }
      menuItems.push(
        {
          label: `Edit kegiatan`,
          icon: <PencilSimple className="h-4 w-4" />,
          onSelect: () => onEditEvent(event),
        },
        {
          label: `Hapus kegiatan`,
          icon: <Trash className="h-4 w-4" />,
          onSelect: () => onDeleteEvent(event.id, event.name),
          tone: 'danger',
        }
      );
    }

    return {
      id: event.id,
      title: event.name,
      meta: [event.location_name, qrPolicyLabel(event), startsAtLabel(event)]
        .filter(Boolean)
        .join('  ·  '),
      status: { label: statusLabel(event.status), tone: eventStatusTone(event.status) },
      action: (
        <span className="flex items-center gap-1">
          {/* Desktop keeps the inline cluster; below `sm` the same actions live
              in the kebab, because up to six 44px targets do not fit a 344px row. */}
          <span className="hidden items-center gap-1 sm:flex">
            {event.status === 'active' && onScanEvent && (
              <button
                type="button"
                onClick={() => onScanEvent(event)}
                title="Buka kamera pemindai"
                aria-label={`Buka kamera pemindai untuk`}
                className={iconButtonClass('pen')}
              >
                <QrCode className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectEvent(event)}
              title="Detail kegiatan"
              aria-label={`Detail`}
              className={iconButtonClass('neutral')}
            >
              <Eye className="h-4 w-4" />
            </button>
            {canManage && (
              <>
                {event.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => onActivateEvent(event.id)}
                    title="Aktifkan Event"
                    aria-label={`Aktifkan event`}
                    className={iconButtonClass('seal')}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                )}
                {event.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => onCloseEvent(event.id)}
                    title="Tutup Event"
                    aria-label={`Tutup event`}
                    className={iconButtonClass('neutral')}
                  >
                    <Stop className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEditEvent(event)}
                  title="Edit Kegiatan"
                  aria-label={`Edit kegiatan`}
                  className={iconButtonClass('neutral')}
                >
                  <PencilSimple className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteEvent(event.id, event.name)}
                  title="Hapus Kegiatan"
                  aria-label={`Hapus kegiatan`}
                  className={iconButtonClass('danger')}
                >
                  <Trash className="h-4 w-4" />
                </button>
              </>
            )}
          </span>
          <RowActions className="sm:hidden" label={`Menu aksi`} items={menuItems} />
        </span>
      ),
    };
  });

  return (
    <RowList
      items={items}
      onSelect={(id) => {
        const event = events.find((e) => e.id === id);
        if (event) onSelectEvent(event);
      }}
      selectable={Boolean(onToggleSelect)}
      selectedIds={selectedIds}
      onToggle={onToggleSelect}
      onToggleAll={onToggleSelectAll}
      itemLabel="kegiatan"
    />
  );
};