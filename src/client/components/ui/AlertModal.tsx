import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

export interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  type?: AlertType;
  buttonText?: string;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  type = 'error',
  buttonText = 'Mengerti',
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getStyle = () => {
    switch (type) {
      case 'error':
        return {
          icon: <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />,
          iconBg: 'bg-rose-950/80 border-rose-800/60 shadow-rose-950/50',
          btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />,
          iconBg: 'bg-amber-950/80 border-amber-800/60 shadow-amber-950/50',
          btnBg: 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold shadow-amber-600/30',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />,
          iconBg: 'bg-emerald-950/80 border-emerald-800/60 shadow-emerald-950/50',
          btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold shadow-emerald-600/30',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-6 h-6 text-sky-400 shrink-0" />,
          iconBg: 'bg-sky-950/80 border-sky-800/60 shadow-sky-950/50',
          btnBg: 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-sky-500/30',
        };
    }
  };

  const style = getStyle();

  return (
    <div className="modal-backdrop-full animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 text-slate-100 relative my-auto"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${style.iconBg}`}
          >
            {style.icon}
          </div>
          <div className="space-y-1 pt-1 pr-4">
            <h3 className="font-heading font-bold text-base text-white leading-snug">
              {title}
            </h3>
            <div className="text-xs text-slate-300 leading-relaxed break-words">
              {message}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${style.btnBg}`}
          >
            <span>{buttonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
