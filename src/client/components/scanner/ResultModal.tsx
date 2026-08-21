import React from 'react';
import { CheckCircle2, XCircle, User, Building2, Calendar, Clock, X } from 'lucide-react';

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

interface ResultModalProps {
  result: ScanResultData | null;
  onDismiss: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ result, onDismiss }) => {
  if (!result) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in"
      onClick={onDismiss}
    >
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border transition-transform animate-in zoom-in-95 ${
          result.success
            ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/50 ring-4 ring-emerald-500/20'
            : 'bg-gradient-to-b from-slate-900 via-slate-900 to-rose-950/40 border-rose-500/50 ring-4 ring-rose-500/20'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {result.success ? (
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 animate-bounce">
                <CheckCircle2 className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400">
                <XCircle className="w-7 h-7" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold font-heading">
                {result.success ? 'ABSENSI BERHASIL' : 'ABSENSI DITOLAK'}
              </h3>
              <p
                className={`text-xs font-semibold ${
                  result.success ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.success
                  ? result.attendance?.sessionType || 'CHECK-IN VALID'
                  : result.code || 'INVALID_QR'}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Card */}
        {result.success && result.attendance ? (
          <div className="space-y-3.5 bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Nama Anggota
              </span>
              <p className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{result.attendance.memberName}</span>
              </p>
              <p className="text-xs text-sky-400 font-mono mt-0.5">
                ID: {result.attendance.memberExternalId}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Divisi
                </span>
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{result.attendance.memberDivision || '-'}</span>
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Grup / Kategori
                </span>
                <p className="text-sm font-semibold text-slate-200 truncate mt-0.5">
                  {result.attendance.memberGroup || '-'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate max-w-[160px]">{result.attendance.eventName}</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
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
        ) : (
          <div className="bg-slate-950/60 rounded-2xl p-5 border border-rose-900/40 text-center">
            <p className="text-sm font-semibold text-rose-300 mb-2">
              {result.message || 'QR Code tidak dapat diverifikasi'}
            </p>
            <p className="text-xs text-slate-400">
              Pastikan QR Code sesuai dengan kegiatan yang aktif dan anggota belum melakukan absensi untuk sesi ini.
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={onDismiss}
          className={`w-full mt-5 py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all active:scale-[0.98] ${
            result.success
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
          }`}
        >
          Lanjut Scan Berikutnya (OK)
        </button>
      </div>
    </div>
  );
};
