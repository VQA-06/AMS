import React, { useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { DeviceMobile } from '@phosphor-icons/react/DeviceMobile';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { X } from '@phosphor-icons/react/X';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { FloatingSurface } from '../ui/FloatingSurface';
import { IosInstallGuideModal } from './IosInstallGuideModal';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/**
 * The install prompt and the update notice are two different asks, so the
 * surface carries a rail only while it is genuinely asking for the update —
 * brass on install, ochre on update. An install prompt that loops a pulse
 * reads as ongoing state; this is a one-shot offer, so it gets `.pop-once` and
 * nothing that repeats.
 */
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

  const actionLabel = updateAvailable ? 'Reload' : installing ? 'Memasang…' : 'Pasang';
  const actionIcon = updateAvailable ? (
    <ArrowClockwise size={14} className="animate-spin" aria-hidden="true" />
  ) : isIos ? (
    <DeviceMobile size={14} aria-hidden="true" />
  ) : (
    <DownloadSimple size={14} aria-hidden="true" />
  );

  return (
    <>
      {/* The banner is an ask, not a live indicator: it sits clear of the mobile
          dock and announces itself once, then waits. `FloatingSurface` supplies
          role="status" + aria-live="polite" so the prompt is announced. */}
      <FloatingSurface
        placement="bottom-bar"
        mark={updateAvailable ? 'pending' : 'pen'}
        offsetClass="bottom-[calc(6.5rem+env(safe-area-inset-bottom))] px-3 sm:bottom-0 sm:px-6"
        className="pop-once mx-auto max-w-3xl gap-2.5"
      >
        {/* App icon + compact info */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <img
            src="/logo.webp"
            alt=""
            className="h-8 w-8 shrink-0 rounded-chip border border-rule bg-paper object-contain"
          />
          <div className="min-w-0">
            <p className="truncate font-heading text-xs font-bold text-ink">
              {updateAvailable ? 'Update AMS Siap' : 'AMS | Computer Community'}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-ink-2">
              {updateAvailable
                ? 'Klik untuk memuat versi terbaru'
                : 'Pasang di layar utama & offline mode'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            aria-label={
              updateAvailable ? 'Muat versi terbaru sekarang' : 'Pasang aplikasi di perangkat ini'
            }
            className={`flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-chip bg-pen-500 px-3 py-1.5 text-xs font-bold text-paper transition-colors hover:bg-pen-400 active:bg-pen-600 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          >
            {actionIcon}
            <span>{actionLabel}</span>
          </button>

          {!updateAvailable && (
            <button
              type="button"
              onClick={() => dismissPrompt(7)}
              aria-label="Tutup ajakan pasang, ingatkan lagi dalam 7 hari"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-chip text-ink-2 transition-colors hover:bg-paper hover:text-ink ${focusRing}`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </FloatingSurface>

      {/* iOS Safari Guide Modal */}
      <IosInstallGuideModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
    </>
  );
};