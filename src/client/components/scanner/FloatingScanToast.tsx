import React, { useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  User,
  Building2,
  Calendar,
  Clock,
  X,
} from 'lucide-react';
import { ScanResultData } from './ResultModal';

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

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed top-4 inset-x-3 sm:top-5 sm:left-1/2 sm:-translate-x-1/2 md:top-6 md:right-6 md:left-auto md:translate-x-0 z-50 w-auto sm:w-[94%] md:w-full max-w-sm pointer-events-auto animate-in slide-in-from-top-4 md:slide-in-from-right-4 duration-200 fade-in"
    >
      <div
        className={`w-full rounded-2xl p-3.5 sm:p-4 shadow-2xl border relative overflow-hidden transition-all ${
          result.success
            ? 'bg-slate-900 border-emerald-500/80 ring-2 ring-emerald-500/20 text-white'
            : 'bg-slate-900 border-rose-500/80 ring-2 ring-rose-500/20 text-white'
        }`}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {result.success ? (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
            )}

            <div className="truncate">
              <div className="flex items-center gap-2">
                <h4 className="font-heading font-bold text-sm sm:text-base leading-none">
                  {result.success ? 'ABSENSI BERHASIL' : 'SCAN DITOLAK'}
                </h4>
                {result.success && result.attendance && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {result.attendance.sessionType}
                  </span>
                )}
              </div>
              {!result.success && (
                <p className="text-xs font-semibold text-rose-300 mt-0.5 truncate">
                  {result.message || 'QR Code tidak valid atau ditolak.'}
                </p>
              )}
            </div>
          </div>

          {/* Quick Close Button */}
          <button
            onClick={onDismiss}
            aria-label="Tutup notifikasi"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member Details (When Success) */}
        {result.success && result.attendance && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">{result.attendance.memberName}</span>
              </span>
              <span className="font-mono text-sky-400 text-xs font-semibold shrink-0">
                ID: {result.attendance.memberExternalId}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span className="truncate flex items-center gap-1">
                {result.attendance.memberDivision ? (
                  <span className="text-slate-300 font-medium">
                    Divisi: {result.attendance.memberDivision}
                  </span>
                ) : (
                  <span className="text-slate-400">{result.attendance.eventName}</span>
                )}
              </span>

              <span className="flex items-center gap-1 font-mono text-slate-400 shrink-0">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>
                  {new Date(result.attendance.scannedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Bottom Auto-Dismiss Progress Bar (Driven 100% by GPU CSS Animation) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className={`h-full animate-toast-progress ${
              result.success ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
        </div>
      </div>
    </aside>
  );
};
