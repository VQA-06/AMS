import React from 'react';
import { History, CheckCircle, XCircle, ChevronUp, ChevronDown, User, Clock } from 'lucide-react';
import { ScanResultData } from './ResultModal';

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
    <div className="w-full glass-panel-elevated rounded-t-3xl border-t border-slate-800 transition-all duration-300 shadow-2xl">
      {/* Drawer Handle Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left focus:outline-none"
      >
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-bold text-slate-200">Riwayat Scan Terbaru</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-sky-400">
            {scans.length}
          </span>
        </div>
        <div className="p-1 rounded-lg bg-slate-800/80 text-slate-400">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </button>

      {/* Drawer List Content */}
      {isOpen && (
        <div className="px-4 pb-4 max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-800/50">
          {scans.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              Belum ada riwayat scan pada sesi ini.
            </p>
          ) : (
            scans.map((scan, idx) => (
              <div key={idx} className="pt-2 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  {scan.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className="font-semibold text-slate-200 truncate">
                      {scan.attendance?.memberName || scan.message || 'Scan Gagal'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {scan.attendance?.memberDivision
                        ? `Divisi: ${scan.attendance.memberDivision}`
                        : scan.attendance?.memberExternalId || scan.code}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono text-[11px] text-slate-400">
                  {scan.attendance?.scannedAt
                    ? new Date(scan.attendance.scannedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Baru saja'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
