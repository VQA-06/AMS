import React, { useState } from 'react';
import { Download, X, RefreshCw, Smartphone, Sparkles } from 'lucide-react';
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
      {/* Top Floating Pill Banner (Zero Overlap with Bottom Navigation) */}
      <div className="fixed top-3 inset-x-3 md:top-4 md:right-4 md:left-auto md:max-w-md z-50">
        <div className="glass-panel-elevated rounded-2xl md:rounded-full px-3 py-2 border border-sky-500/40 shadow-xl shadow-sky-500/15 backdrop-blur-xl bg-slate-900/95 flex items-center justify-between gap-2.5">
          {/* App Icon & Compact Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-white via-slate-50 to-slate-100 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/10 border border-white/40 ring-1 ring-white/20 shrink-0">
              <img src="/logo.webp" alt="AMS Icon" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <h4 className="font-bold text-xs text-white truncate">
                  {updateAvailable ? 'Update AMS Siap' : 'AMS | Computer Community'}
                </h4>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
                  {updateAvailable ? 'Update' : 'PWA'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {updateAvailable
                  ? 'Klik untuk memuat versi terbaru'
                  : 'Pasang di layar utama & offline mode'}
              </p>
            </div>
          </div>

          {/* Compact Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors transition-transform shadow-md shadow-sky-500/20 active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {updateAvailable ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Reload</span>
                </>
              ) : isIos ? (
                <>
                  <Smartphone className="w-3 h-3" />
                  <span>Pasang</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  <span>{installing ? '...' : 'Pasang'}</span>
                </>
              )}
            </button>

            {!updateAvailable && (
              <button
                onClick={() => dismissPrompt(7)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Tutup (ingatkan 7 hari lagi)"
              >
                <X className="w-3.5 h-3.5" />
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
