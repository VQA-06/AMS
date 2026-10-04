import React, { useEffect } from 'react';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Clock } from '@phosphor-icons/react/Clock';
import { User } from '@phosphor-icons/react/User';
import { Warning } from '@phosphor-icons/react/Warning';
import { X } from '@phosphor-icons/react/X';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { cn } from '../../lib/cn';
import { FloatingSurface } from '../ui/FloatingSurface';
import { ScanResultData, ScanOutcome, scanOutcome } from './ResultModal';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/** Same outcome→hue contract as `ResultModal`: a result never changes colour
 *  between the toast, the history sheet, and the modal. */
const outcomeTone: Record<
  ScanOutcome,
  { text: string; chip: string; icon: React.ReactNode }
> = {
  accepted: {
    text: 'text-seal-800',
    chip: 'border-seal-200/70 bg-seal-50/60 text-seal-800',
    icon: <CheckCircle className="h-5 w-5 shrink-0 text-seal-600" />,
  },
  rejected: {
    text: 'text-pending-800',
    chip: 'border-pending-200/70 bg-pending-50/60 text-pending-800',
    icon: <Warning className="h-5 w-5 shrink-0 text-pending-600" />,
  },
  error: {
    text: 'text-pen-deep',
    chip: 'border-pen-200/70 bg-pen-50/70 text-pen-deep',
    icon: <XCircle className="h-5 w-5 shrink-0 text-pen" />,
  },
};

interface FloatingScanToastProps {
  result: ScanResultData | null;
  onDismiss: () => void;
  duration?: number;
}

export const FloatingScanToast: React.FC<FloatingScanToastProps> = ({
  result,
  onDismiss,
  duration = 3500,
}) => {
  useEffect(() => {
    if (!result) return;

    // Single timeout for dismissal — Zero React re-renders while toast is visible!
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [result, duration, onDismiss]);

  if (!result) return null;

  const outcome = scanOutcome(result);
  const tone = outcomeTone[outcome];
  const accepted = outcome === 'accepted';
  const a = result.attendance;

  return (
    // `FloatingSurface` owns the fixed chrome, the safe area, and the z-layer;
    // it already renders role="status" aria-live="polite", which is exactly the
    // announcement a scan result owes a screen-reader user in the field.
    <FloatingSurface
      placement="bottom-bar"
      mark={
        outcome === 'accepted'
          ? 'seal'
          : outcome === 'rejected'
            ? 'pending'
            : 'danger'
      }
      offsetClass="pb-24 md:pb-4"
      className="mx-3 sm:mx-auto sm:max-w-md"
    >
      {/* One child: `FloatingSurface` lays children out in a row, so the toast
          composes its own column to keep the headline above the detail block. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {tone.icon}
              {/* Held one-handed in the field: the headline is the largest type
                on the surface, because it is what gets read at arm's length. */}
              <h3 className="font-heading text-base font-bold leading-none text-ink sm:text-lg">
                {accepted ? 'ABSENSI BERHASIL' : 'SCAN DITOLAK'}
              </h3>
              {accepted && a && (
                <span
                  className={cn(
                    'shrink-0 rounded-chip border px-2 py-0.5 font-oxanium text-[10px] font-bold uppercase tracking-wider',
                    tone.chip,
                  )}
                >
                  {a.sessionType}
                </span>
              )}
            </div>

            {accepted && a ? (
              <p className="mt-1 truncate text-sm font-bold text-ink sm:text-base">
                {a.memberName}
              </p>
            ) : (
              <p
                className={cn(
                  'mt-1 truncate text-xs font-semibold sm:text-sm',
                  tone.text,
                )}
              >
                {result.message || 'QR Code tidak valid atau ditolak.'}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup notifikasi"
            className={cn(
              'touch-target shrink-0 rounded-chip border border-rule bg-paper-raised text-ink-2 transition-colors duration-120 hover:text-ink',
              focusRing,
            )}
          >
            <X className="mx-auto h-4 w-4" />
          </button>
        </div>

        {accepted && a && (
          <>
            <dl className="flex flex-col gap-1 border-t border-rule pt-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex shrink-0 items-center gap-1.5 text-ink-2">
                  <Buildings className="h-3.5 w-3.5" />
                  Divisi
                </dt>
                <dd className="truncate text-ink">
                  {a.memberDivision || '-'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex shrink-0 items-center gap-1.5 text-ink-2">
                  <User className="h-3.5 w-3.5" />
                  ID
                </dt>
                <dd className="truncate font-oxanium text-ink">
                  {a.memberExternalId}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex shrink-0 items-center gap-1.5 text-ink-2">
                  <CalendarBlank className="h-3.5 w-3.5" />
                  Kegiatan
                </dt>
                <dd className="truncate text-ink">{a.eventName}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex shrink-0 items-center gap-1.5 text-ink-2">
                  <Clock className="h-3.5 w-3.5" />
                  Waktu
                </dt>
                <dd className="font-oxanium text-ink">
                  {new Date(a.scannedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
            </dl>

            {/* Auto-dismiss countdown. Pure width animation, no re-renders. */}
            <span
              aria-hidden="true"
              className="toast-progress block h-0.5 w-full rounded-chip bg-seal-100"
              style={{ animationDuration: `${duration}ms` }}
            />
          </>
        )}
      </div>
    </FloatingSurface>
  );
};
