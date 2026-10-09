import React, { useState, useEffect } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { WifiHigh } from '@phosphor-icons/react/WifiHigh';
import { WifiSlash } from '@phosphor-icons/react/WifiSlash';
import { FloatingSurface } from '../ui/FloatingSurface';

/**
 * The persistent top bar. It is genuinely ongoing state, so `animate-pulse`
 * stays here — it is the one place a looping pulse carries information rather
 * than decoration. `FloatingSurface` owns `role="status"` + `aria-live="polite"`
 * so a screen-reader user hears the connection drop.
 */
export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showRestored, setShowRestored] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) {
    return null;
  }

  if (showRestored) {
    return (
      <FloatingSurface placement="top-bar" mark="seal">
        <WifiHigh className="h-4 w-4 shrink-0 text-seal-800 animate-pulse" />
        <span className="text-xs font-medium text-seal-800 sm:text-sm">
          Koneksi internet kembali aktif. Sistem tersinkronisasi.
        </span>
      </FloatingSurface>
    );
  }

  return (
    <FloatingSurface placement="top-bar" mark="pending">
      <WifiSlash className="h-4 w-4 shrink-0 text-pending-800 animate-pulse" />
      <span className="text-xs font-semibold text-pending-800 sm:text-sm">
        Koneksi internet terputus. Beberapa aksi mungkin tertunda.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        aria-label="Muat ulang halaman"
        className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-chip bg-ink/30 px-2.5 py-1 text-xs font-bold text-pending-800 transition-colors duration-120 hover:bg-ink/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <ArrowClockwise className="h-3 w-3" />
        <span>Coba Muat Ulang</span>
      </button>
    </FloatingSurface>
  );
};