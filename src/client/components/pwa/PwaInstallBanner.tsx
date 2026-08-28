import React, { useState } from 'react';
import { Download, Sparkles, X, RefreshCw, Smartphone, ChevronRight } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { IosInstallGuideModal } from './IosInstallGuideModal';

export const PwaInstallBanner: React.FC = () => {
  const {
    isInstallable,
    isInstalled,
    isIos,
    isDismissed,
    isNativePromptReady,
    updateAvailable,
    installApp,
    dismissPrompt,
    applyUpdate,
  } = usePwaInstall();

  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [installing, setInstalling] = useState<boolean>(false);

  // If already installed and no update is available, don't render banner
  if (isInstalled && !updateAvailable) {
    return null;
  }

  // If dismissed and no update is available, don't render banner
  if (isDismissed && !updateAvailable) {
    return null;
  }

  // If not installable and no update is available, don't render banner
  if (!isInstallable && !updateAvailable) {
    return null;
  }

  const handleInstallClick = async () => {
    if (updateAvailable) {
      applyUpdate();
      return;
    }

    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (isNativePromptReady) {
      setInstalling(true);
      try {
        await installApp();
      } finally {
        setInstalling(false);
      }
    }
  };

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 right-3 left-3 md:left-auto md:right-6 md:max-w-md z-40 animate-in slide-in-from-bottom-5 duration-300">
        <div className="glass-panel-elevated rounded-2xl p-3.5 border border-sky-500/40 shadow-2xl shadow-sky-500/10 backdrop-blur-xl bg-slate-900/95 flex items-center justify-between gap-3">
          {/* App Icon & Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-white via-slate-50 to-slate-100 p-1 flex items-center justify-center shadow-md shadow-sky-500/20 ring-1 ring-white/30 shrink-0">
              <img src="/logo.webp" alt="AMS Icon" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                  {updateAvailable ? 'Pembaruan AMS Siap' : 'Pasang Aplikasi AMS'}
                </h4>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  {updateAvailable ? 'Update' : 'PWA'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {updateAvailable
                  ? 'Versi terbaru sistem siap diterapkan'
                  : 'Akses instan di layar utama & mode offline'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-sky-500/20 active:scale-95"
            >
              {updateAvailable ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reload</span>
                </>
              ) : isIos ? (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Petunjuk</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{installing ? 'Memasang...' : 'Pasang'}</span>
                </>
              )}
            </button>

            {!updateAvailable && (
              <button
                onClick={() => dismissPrompt(7)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Tutup banner (ingatkan 7 hari lagi)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      <IosInstallGuideModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
    </>
  );
};
