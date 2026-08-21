import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

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
      <div className="bg-emerald-500/90 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-lg backdrop-blur-md sticky top-0 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <Wifi className="w-4 h-4 text-white animate-pulse" />
        <span>Koneksi internet kembali aktif. Sistem tersinkronisasi.</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/95 text-slate-950 px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xl backdrop-blur-md sticky top-0 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-slate-950 animate-bounce" />
        <span>Koneksi internet terputus. Beberapa aksi mungkin tertunda.</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-2.5 py-1 bg-slate-950/20 hover:bg-slate-950/30 rounded text-xs font-bold transition-colors flex items-center gap-1.5"
      >
        <RefreshCw className="w-3 h-3" />
        Coba Muat Ulang
      </button>
    </div>
  );
};
