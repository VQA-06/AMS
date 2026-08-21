import React, { useState } from 'react';
import {
  Compass,
  ShieldAlert,
  AlertTriangle,
  WifiOff,
  Home,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type ErrorPageCode = '404' | '403' | '500' | 'offline';

export interface ErrorPageProps {
  code?: ErrorPageCode;
  title?: string;
  description?: string;
  details?: string;
  onNavigateHome?: () => void;
  onRetry?: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  code = '404',
  title,
  description,
  details,
  onNavigateHome,
  onRetry,
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyDetails = () => {
    if (!details) return;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConfig = () => {
    switch (code) {
      case '403':
        return {
          badge: '403 FORBIDDEN',
          defaultTitle: 'Akses Ditolak',
          defaultDesc:
            'Akun Anda tidak memiliki hak akses atau izin yang sesuai untuk membuka halaman atau fitur ini.',
          icon: <ShieldAlert className="w-10 h-10 text-amber-400" />,
          glow: 'from-amber-500/20 to-orange-600/10',
          badgeStyle: 'bg-amber-950/80 border-amber-800/60 text-amber-300',
          btnStyle: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20',
        };
      case '500':
        return {
          badge: '500 SYSTEM ERROR',
          defaultTitle: 'Terjadi Kesalahan Aplikasi',
          defaultDesc:
            'Aplikasi mendeteksi kendala pada pemrosesan antarmuka. Anda dapat memuat ulang aplikasi atau memeriksa detail error.',
          icon: <AlertTriangle className="w-10 h-10 text-rose-400" />,
          glow: 'from-rose-500/20 to-red-600/10',
          badgeStyle: 'bg-rose-950/80 border-rose-800/60 text-rose-300',
          btnStyle: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20',
        };
      case 'offline':
        return {
          badge: 'OFFLINE MODE',
          defaultTitle: 'Koneksi Terputus',
          defaultDesc:
            'Perangkat Anda saat ini tidak terhubung ke jaringan internet atau server Cloudflare tidak dapat dijangkau.',
          icon: <WifiOff className="w-10 h-10 text-cyan-400" />,
          glow: 'from-cyan-500/20 to-blue-600/10',
          badgeStyle: 'bg-cyan-950/80 border-cyan-800/60 text-cyan-300',
          btnStyle: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20',
        };
      case '404':
      default:
        return {
          badge: '404 NOT FOUND',
          defaultTitle: 'Halaman Tidak Ditemukan',
          defaultDesc:
            'Rute atau halaman yang Anda cari tidak tersedia, sudah dipindahkan, atau telah dihapus dari sistem AMS.',
          icon: <Compass className="w-10 h-10 text-sky-400" />,
          glow: 'from-sky-500/20 to-blue-600/10',
          badgeStyle: 'bg-sky-950/80 border-sky-800/60 text-sky-300',
          btnStyle: 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20',
        };
    }
  };

  const config = getConfig();
  const displayTitle = title || config.defaultTitle;
  const displayDesc = description || config.defaultDesc;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 duration-300 relative">
      {/* Glow Effect */}
      <div
        className={`absolute w-72 h-72 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${config.glow}`}
      />

      <div className="w-full max-w-md glass-panel-elevated rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative z-10 space-y-6">
        {/* Icon & Code Badge */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-center relative">
            {config.icon}
          </div>
          <span
            className={`px-3 py-1 rounded-xl text-[11px] font-mono font-bold tracking-wider border shadow-sm uppercase ${config.badgeStyle}`}
          >
            {config.badge}
          </span>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-white">
            {displayTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            {displayDesc}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          {code === '500' || code === 'offline' ? (
            <button
              type="button"
              onClick={onRetry || (() => window.location.reload())}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${config.btnStyle}`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={
              onNavigateHome ||
              (() => {
                if (typeof window !== 'undefined') {
                  window.history.pushState(null, '', '/dashboard');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              })
            }
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
              code === '404' || code === '403' ? config.btnStyle : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>
        </div>

        {/* Technical Error Details Accordion (for 500) */}
        {details && (
          <div className="pt-3 border-t border-slate-800/80 text-left space-y-2">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 text-xs py-1 transition-colors"
            >
              <span>Detail Teknis Error</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDetails && (
              <div className="relative animate-in fade-in duration-200">
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-rose-300/90 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                  {details}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] flex items-center gap-1 shadow"
                  title="Salin Error"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
