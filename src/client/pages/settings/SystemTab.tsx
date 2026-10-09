import React, { useEffect, useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { DeviceMobile } from '@phosphor-icons/react/DeviceMobile';
import { Minus } from '@phosphor-icons/react/Minus';
import { Trash } from '@phosphor-icons/react/Trash';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

/**
 * Real runtime state only: display mode, service worker registration, and
 * connectivity. Nothing here is a static claim about the stack — a badge that
 * says "installed" while the app is not actually installed is worse than no
 * badge, because it trains the reader to trust a decoration.
 */
export const SystemTab: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [serviceWorkerState, setServiceWorkerState] = useState<
    'checking' | 'active' | 'unsupported'
  >('checking');
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [clearingCache, setClearingCache] = useState<boolean>(false);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setServiceWorkerState('unsupported');
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!cancelled) setServiceWorkerState(reg ? 'active' : 'unsupported');
      })
      .catch(() => {
        if (!cancelled) setServiceWorkerState('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckForUpdate = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    setSystemNotice('Memeriksa pembaruan Service Worker...');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setSystemNotice('Service Worker belum terdaftar di perangkat ini.');
        return;
      }
      await reg.update();
      setSystemNotice('Pemeriksaan update Service Worker berhasil dijalankan.');
    } catch {
      setSystemNotice('Pemeriksaan update Service Worker gagal dijalankan.');
    }
  };

  // iOS Safari ships `navigator.standalone` instead of honouring the
  // display-mode media query. It is a legacy DOM extension, absent from
  // lib.dom, so narrow it by shape rather than asserting an inline object
  // type — an unchecked cast there would read `undefined` on every desktop
  // browser and quietly claim "Browser" for a genuinely installed PWA.
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && window.navigator.standalone === true));

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
        <Card className="space-y-4 p-5 sm:p-6 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
              <DeviceMobile className="h-4 w-4 text-seal-600" />
              <span>Progressive Web App (PWA) &amp; Offline Shell</span>
            </h2>
            {isStandalone ? (
              <Badge variant="seal" size="xs">
                Terpasang sebagai PWA
              </Badge>
            ) : (
              <Badge variant="neutral" size="xs">
                Mode Browser
              </Badge>
            )}
          </div>

          <p className="text-xs text-ink">
            AMS mendukung instalasi mandiri di Android, iOS, Windows, macOS, dan
            Linux dengan kemampuan caching offline penuh.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-1 text-xs sm:grid-cols-3">
            <div className="surface-raised space-y-1 rounded-panel p-3.5">
              <span className="block text-[11px] font-medium text-ink-2">Mode Tampilan:</span>
              <span className="font-bold text-ink-2">
                {isStandalone ? 'Aplikasi Mandiri (Standalone PWA)' : 'Peramban Web (Browser)'}
              </span>
            </div>

            <div className="surface-raised space-y-1 rounded-panel p-3.5">
              <span className="block text-[11px] font-medium text-ink-2">Service Worker:</span>
              <span className="flex items-center gap-1.5 font-bold text-ink">
                {serviceWorkerState === 'active' ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-seal-600" />
                    Aktif &amp; Terdaftar
                  </>
                ) : serviceWorkerState === 'checking' ? (
                  <>
                    <ArrowClockwise className="h-3.5 w-3.5 animate-pulse text-pending-600" />
                    Memeriksa...
                  </>
                ) : (
                  <>
                    <Minus className="h-3.5 w-3.5 text-ink-2" />
                    Tidak Terdaftar
                  </>
                )}
              </span>
            </div>

            <div className="surface-raised space-y-1 rounded-panel p-3.5">
              <span className="block text-[11px] font-medium text-ink-2">Konektivitas Jaringan:</span>
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${isOnline ? 'bg-seal-400' : 'bg-pen-400'}`}
                />
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {systemNotice && (
            <p role="status" aria-live="polite" className="text-xs text-ink-2">
              {systemNotice}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCheckForUpdate}
              icon={<ArrowClockwise className="h-3.5 w-3.5" />}
            >
              Cek Pembaruan App
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearingCache(true)}
              icon={<Trash className="h-3.5 w-3.5" />}
            >
              Bersihkan Cache Offline &amp; Reload
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmModal
        isOpen={clearingCache}
        title="Bersihkan Cache Offline"
        message="Semua aset offline (service worker & cache browser) akan dihapus dan aplikasi dimuat ulang. Anda tetap bisa masuk, tetapi data yang belum tersinkron akan hilang."
        type="warning"
        confirmText="Ya, Bersihkan Cache"
        cancelText="Batal"
        onClose={() => setClearingCache(false)}
        onConfirm={async () => {
          setClearingCache(false);
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map((name) => caches.delete(name)));
          }
          window.location.reload();
        }}
      />
    </>
  );
};