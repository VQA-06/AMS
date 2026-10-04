import React from 'react';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Clock } from '@phosphor-icons/react/Clock';
import { User } from '@phosphor-icons/react/User';
import { Warning } from '@phosphor-icons/react/Warning';
import { X } from '@phosphor-icons/react/X';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { ModalPortal } from '../ui/ModalPortal';

export interface ScanResultData {
  success: boolean;
  code?: string;
  message?: string;
  attendance?: {
    id: string;
    memberName: string;
    memberExternalId: string;
    memberDivision?: string | null;
    memberGroup?: string | null;
    eventName: string;
    sessionType: string;
    scannedAt: string;
  };
}

/** The outcome hue a scan result carries: accepted, a policy rejection, or a
 *  genuine failure. Every scan surface (toast, modal, history) reads its hue
 *  from here so the same result never changes colour between screens. */
export type ScanOutcome = 'accepted' | 'rejected' | 'error';

/**
 * Rejections the domain returns for a *legitimate* scan of a token that simply
 * does not qualify. These are policy verdicts, not faults, so they read as
 * ochre ("needs attention"), never as a red error.
 */
const POLICY_REJECTIONS: Record<string, true> = {
  ALREADY_SCANNED: true,
  WRONG_EVENT: true,
  TOKEN_REVOKED: true,
  TOKEN_EXPIRED: true,
  TOKEN_NOT_ACTIVE_YET: true,
  MAX_USES_EXCEEDED: true,
  UNIVERSAL_NOT_ALLOWED: true,
  EVENT_INACTIVE: true,
  EVENT_NOT_STARTED: true,
  EVENT_ENDED: true,
  EVENT_CLOSED: true,
  MEMBER_INACTIVE: true,
};

/** `accepted` → jade, `rejected` → ochre, `error` → danger. The rail class is
 *  spelled out per tone rather than interpolated, so Tailwind can see it. */
const outcomeTone: Record<
  ScanOutcome,
  { railClass: string; text: string; chip: string }
> = {
  accepted: {
    railClass: 'bg-seal-500',
    text: 'text-seal-600',
    chip: 'border-seal-200/70 bg-seal-50/60 text-seal-800',
  },
  rejected: {
    railClass: 'bg-pending-500',
    text: 'text-pending-600',
    chip: 'border-pending-200/70 bg-pending-50/60 text-pending-800',
  },
  error: {
    railClass: 'bg-pen-500',
    text: 'text-pen',
    chip: 'border-pen-200/70 bg-pen-50/70 text-pen-deep',
  },
};
export const scanOutcome = (result: ScanResultData): ScanOutcome => {
  if (result.success) return 'accepted';
  const code = result.code || '';
  if (POLICY_REJECTIONS[code]) return 'rejected';
  // `SCAN_REJECTED` is the client's own fallback for a bodyless failure — we
  // could not classify it, so it must not be painted as a clean policy verdict.
  return 'error';
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

interface ResultModalProps {
  result: ScanResultData | null;
  onDismiss: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  result,
  onDismiss,
}) => {
  if (!result) return null;

  const outcome = scanOutcome(result);
  const tone = outcomeTone[outcome];
  const accepted = outcome === 'accepted';

  return (
    <ModalPortal onClose={onDismiss}>
      <div className="modal-backdrop-full" onClick={onDismiss}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            accepted ? 'Hasil absensi berhasil' : 'Hasil absensi ditolak'
          }
          className="surface my-auto w-full max-w-md overflow-hidden rounded-bezel shadow-ambient"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-0 overflow-hidden rounded-bezel">
            {/* The rail carries the outcome — it varies per result, so it is
                information, not decoration. */}
            <span
              aria-hidden="true"
              className={cn('rail self-stretch', tone.railClass)}
            />
            <div className="min-w-0 flex-1 p-4 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'pop-once flex h-12 w-12 shrink-0 items-center justify-center rounded-panel border',
                      tone.chip,
                    )}
                  >
                    {accepted ? (
                      <CheckCircle className="h-7 w-7" />
                    ) : outcome === 'rejected' ? (
                      <Warning className="h-7 w-7" />
                    ) : (
                      <XCircle className="h-7 w-7" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-heading text-xl font-bold">
                      {accepted ? 'ABSENSI BERHASIL' : 'ABSENSI DITOLAK'}
                    </h3>
                    <p
                      className={cn(
                        'truncate font-oxanium text-xs font-semibold',
                        tone.text,
                      )}
                    >
                      {accepted
                        ? result.attendance?.sessionType || 'CHECK-IN VALID'
                        : result.code || 'INVALID_QR'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Tutup hasil pemindaian"
                  className={cn(
                    'touch-target shrink-0 rounded-chip border border-rule bg-paper-raised text-ink-2 transition-colors duration-120 hover:text-white',
                    focusRing,
                  )}
                >
                  <X className="mx-auto h-5 w-5" />
                </button>
              </div>

              {accepted && result.attendance ? (
                <div className="surface-raised space-y-3.5 rounded-panel p-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-2">
                      Nama Anggota
                    </span>
                    <p className="flex items-center gap-2 text-lg font-bold text-white">
                      <User className={cn('h-4 w-4 shrink-0', tone.text)} />
                      <span className="truncate">
                        {result.attendance.memberName}
                      </span>
                    </p>
                    <p className="mt-0.5 font-oxanium text-xs text-ink-2">
                      ID: {result.attendance.memberExternalId}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-rule pt-2">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-2">
                        Divisi
                      </span>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <Buildings className="h-3.5 w-3.5 shrink-0 text-ink-2" />
                        <span className="truncate">
                          {result.attendance.memberDivision || '-'}
                        </span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-2">
                        Grup / Kategori
                      </span>
                      <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                        {result.attendance.memberGroup || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-rule pt-2 text-xs text-ink-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CalendarBlank
                        className={cn('h-3.5 w-3.5 shrink-0', tone.text)}
                      />
                      <span className="max-w-[160px] truncate">
                        {result.attendance.eventName}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-oxanium">
                      <Clock className="h-3.5 w-3.5 text-ink-2" />
                      <span>
                        {new Date(
                          result.attendance.scannedAt,
                        ).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'rounded-panel border p-5 text-center',
                    outcome === 'rejected'
                      ? 'border-pending-200/70 bg-pending-500/5'
                      : 'border-pen-200/70 bg-pen-50/60',
                  )}
                >
                  <p className={cn('mb-2 text-sm font-semibold', tone.text)}>
                    {result.message || 'QR Code tidak dapat diverifikasi'}
                  </p>
                  <p className="text-xs text-ink-2">
                    Pastikan QR Code sesuai dengan kegiatan yang aktif dan
                    anggota belum melakukan absensi untuk sesi ini.
                  </p>
                </div>
              )}

              <Button
                variant={accepted ? 'primary' : 'secondary'}
                size="lg"
                onClick={onDismiss}
                className="mt-5 w-full"
              >
                Lanjut Scan Berikutnya (OK)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
