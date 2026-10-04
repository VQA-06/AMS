import React from 'react';
import { Share, PlusSquare, X, Smartphone, Sparkles, ArrowDown } from 'lucide-react';
import { ModalPortal } from '../ui/ModalPortal';

interface IosInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IosInstallGuideModal: React.FC<IosInstallGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop-full">
        <div className="glass-panel-elevated rounded-3xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl relative space-y-5">
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl glass-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="text-center space-y-2 pt-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white via-slate-50 to-slate-100 p-1.5 mx-auto flex items-center justify-center shadow-lg shadow-sky-500/10 border border-white/40 ring-1 ring-white/20">
              <img src="/logo.webp" alt="AMS Logo" className="w-full h-full object-contain" />
            </div>
            <h3 className="text-base font-bold font-heading text-white">Pasang AMS | Computer Community di iOS</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dapatkan pengalaman aplikasi mandiri (*full screen*), pemindai QR lebih cepat, dan akses instan tanpa bilah browser.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>Tekan tombol <strong>Bagikan (Share)</strong></span>
                  <Share className="w-3.5 h-3.5 text-sky-400" />
                </p>
                <p className="text-slate-400 text-[11px]">
                  Buka menu bagikan di bilah navigasi Safari bagian bawah layar.
                </p>
              </div>
            </div>

            <div className="h-px bg-slate-800/60" />

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>Pilih <strong>Tambahkan ke Layar Utama</strong></span>
                  <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                </p>
                <p className="text-slate-400 text-[11px]">
                  Gulir ke bawah pada menu bagikan dan pilih <em>"Add to Home Screen"</em>.
                </p>
              </div>
            </div>

            <div className="h-px bg-slate-800/60" />

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-200">
                  Tekan <strong>Tambah (Add)</strong> di pojok kanan atas
                </p>
                <p className="text-slate-400 text-[11px]">
                  Aplikasi AMS siap dibuka langsung dari Home Screen perangkat Anda!
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors transition-transform shadow-lg shadow-sky-500/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Mengerti
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
