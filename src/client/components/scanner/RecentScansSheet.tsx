import React from 'react';
import { CaretDown } from '@phosphor-icons/react/CaretDown';
import { CaretUp } from '@phosphor-icons/react/CaretUp';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';
import { Warning } from '@phosphor-icons/react/Warning';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { cn } from '../../lib/cn';
import { FloatingSurface } from '../ui/FloatingSurface';
import { ScanResultData, ScanOutcome, scanOutcome } from './ResultModal';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/** Rail hue per outcome. Spelled out rather than interpolated so Tailwind
 *  generates all three classes. Each row's rail comes from that scan's real
 *  outcome, so it varies and carries information. */
const outcomeRail: Record<ScanOutcome, string> = {
  accepted: 'border-l-jade-500',
  rejected: 'border-l-ochre-500',
  error: 'border-l-danger-500',
};

/** Outcome hue, identical to the toast and the modal — a scan never changes
 *  colour depending on which surface is showing it. */
const outcomeIcon: Record<ScanOutcome, React.ReactNode> = {
  accepted: <CheckCircle className="h-4 w-4 shrink-0 text-seal-600" />,
  rejected: <Warning className="h-4 w-4 shrink-0 text-pending-600" />,
  error: <XCircle className="h-4 w-4 shrink-0 text-pen-600" />,
};

interface RecentScansSheetProps {
  scans: ScanResultData[];
  isOpen: boolean;
  onToggle: () => void;
}

export const RecentScansSheet: React.FC<RecentScansSheetProps> = ({
  scans,
  isOpen,
  onToggle,
}) => {
  return (
    <FloatingSurface
      placement="bottom-sheet"
      offsetClass="pb-24 md:pb-4"
      className="flex-col items-stretch"
      open={isOpen}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-chip px-1 text-left',
          focusRing,
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <ClockCounterClockwise className="h-4 w-4 shrink-0 text-ink-2" />
          <span className="truncate text-sm font-bold text-ink">
            Riwayat Scan Terbaru
          </span>
          <span className="shrink-0 rounded-chip bg-paper px-2 py-0.5 font-oxanium text-xs font-semibold text-ink-2">
            {scans.length}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-paper text-ink-2"
        >
          {isOpen ? (
            <CaretDown className="h-4 w-4" />
          ) : (
            <CaretUp className="h-4 w-4" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="no-scrollbar mt-2 max-h-60 space-y-2 overflow-y-auto pb-1">
          {scans.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-2">
              Belum ada riwayat scan pada sesi ini.
            </p>
          ) : (
            scans.map((scan, idx) => {
              const outcome = scanOutcome(scan);
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center justify-between gap-3 border-l-2 py-2 pl-3 text-xs',
                    outcomeRail[outcome],
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {outcomeIcon[outcome]}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">
                        {scan.attendance?.memberName ||
                          scan.message ||
                          'Scan Gagal'}
                      </span>
                      <span className="block truncate text-[11px] text-ink-2">
                        {scan.attendance?.memberDivision
                          ? `Divisi: ${scan.attendance.memberDivision}`
                          : scan.attendance?.memberExternalId || scan.code}
                      </span>
                    </span>
                  </span>

                  <span className="shrink-0 text-right font-oxanium text-[11px] text-ink-2">
                    {scan.attendance?.scannedAt
                      ? new Date(scan.attendance.scannedAt).toLocaleTimeString(
                          'id-ID',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )
                      : 'Baru saja'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </FloatingSurface>
  );
};
