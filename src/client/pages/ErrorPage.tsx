import React, { useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { CaretDown } from '@phosphor-icons/react/CaretDown';
import { CaretUp } from '@phosphor-icons/react/CaretUp';
import { Check } from '@phosphor-icons/react/Check';
import { Compass } from '@phosphor-icons/react/Compass';
import { Copy } from '@phosphor-icons/react/Copy';
import { House } from '@phosphor-icons/react/House';
import { ShieldWarning } from '@phosphor-icons/react/ShieldWarning';
import { Warning } from '@phosphor-icons/react/Warning';
import { WifiSlash } from '@phosphor-icons/react/WifiSlash';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

export type ErrorPageCode = '404' | '403' | '500' | 'offline';

export interface ErrorPageProps {
  code?: ErrorPageCode;
  title?: string;
  description?: string;
  details?: string;
  onNavigateHome?: () => void;
  onRetry?: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

/**
 * `danger` is reserved for the error state itself. A denied route is not an
 * error, so 403 and offline read as ochre state and a missing route as neutral
 * slate — the retry action, not the hue, is what carries urgency.
 */
const CODE_CONFIG: Record<
  ErrorPageCode,
  {
    badge: string;
    badgeVariant: BadgeVariant;
    ringClass: string;
    defaultTitle: string;
    defaultDesc: string;
    icon: React.ReactNode;
  }
> = {
  '403': {
    badge: '403 FORBIDDEN',
    badgeVariant: 'pending',
    ringClass: 'text-pending-600',
    defaultTitle: 'Akses Ditolak',
    defaultDesc:
      'Akun Anda tidak memiliki hak akses atau izin yang sesuai untuk membuka halaman atau fitur ini.',
    icon: <ShieldWarning className="h-10 w-10 text-pending-600" weight="fill" />,
  },
  '500': {
    badge: '500 SYSTEM ERROR',
    badgeVariant: 'danger',
    ringClass: 'text-pen',
    defaultTitle: 'Terjadi Kesalahan Aplikasi',
    defaultDesc:
      'Aplikasi mendeteksi kendala pada pemrosesan antarmuka. Anda dapat memuat ulang aplikasi atau memeriksa detail error.',
    icon: <Warning className="h-10 w-10 text-pen" weight="fill" />,
  },
  offline: {
    badge: 'OFFLINE MODE',
    badgeVariant: 'pending',
    ringClass: 'text-pending-600',
    defaultTitle: 'Koneksi Terputus',
    defaultDesc:
      'Perangkat Anda saat ini tidak terhubung ke jaringan internet atau server Cloudflare tidak dapat dijangkau.',
    icon: <WifiSlash className="h-10 w-10 text-pending-600" weight="fill" />,
  },
  '404': {
    badge: '404 NOT FOUND',
    badgeVariant: 'neutral',
    ringClass: 'text-ink-2',
    defaultTitle: 'Halaman Tidak Ditemukan',
    defaultDesc:
      'Rute atau halaman yang Anda cari tidak tersedia, sudah dipindahkan, atau telah dihapus dari sistem AMS.',
    icon: <Compass className="h-10 w-10 text-ink-2" weight="fill" />,
  },
};

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
  const config = CODE_CONFIG[code] ?? CODE_CONFIG['404'];



  const displayTitle = title || config.defaultTitle;
  const displayDesc = description || config.defaultDesc;
  const isServerError = code === '500' || code === 'offline';
  const detailsId = 'error-page-technical-details';

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center">
      {/* Centred bezel: a static surface, so a plain hairline edge and no rail. */}
      <div className="bezel w-full max-w-md p-6 shadow-ambient sm:p-8">
        <div className="bezel-core space-y-6 p-5 sm:p-6">
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                'surface-raised flex h-20 w-20 items-center justify-center rounded-panel shadow-lift',
                config.ringClass,
              )}
            >
              {config.icon}
            </div>
            <Badge variant={config.badgeVariant} size="sm">
              {config.badge}
            </Badge>
          </div>

          <div className="space-y-2">
            <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">{displayTitle}</h1>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-ink sm:text-sm">{displayDesc}</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2.5 pt-2">
            {isServerError && (
              <Button
                variant="primary"
                size="md"
                icon={<ArrowClockwise className="h-4 w-4" weight="bold" />}
                onClick={onRetry || (() => window.location.reload())}
                className="w-full sm:w-auto"
              >
                Muat Ulang
              </Button>
            )}

            <Button
              variant={isServerError ? 'outline' : 'primary'}
              size="md"
              icon={<House className="h-4 w-4" weight="bold" />}
              onClick={
                onNavigateHome ||
                (() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/dashboard');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                })
              }
              className="w-full sm:w-auto"
            >
              Kembali ke Beranda
            </Button>
          </div>

          {details && (
            <div className="space-y-2 border-t border-rule pt-3 text-left">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
                aria-controls={detailsId}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-chip py-1 text-xs text-ink-2 transition-colors hover:text-ink',
                  focusRing,
                )}
              >
                <span>Detail Teknis Error</span>
                {showDetails ? (
                  <CaretUp className="h-3.5 w-3.5 shrink-0" weight="bold" />
                ) : (
                  <CaretDown className="h-3.5 w-3.5 shrink-0" weight="bold" />
                )}
              </button>

              {showDetails && (
                <div id={detailsId} className="relative">
                  <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap break-all rounded-chip border border-rule bg-ink p-3 font-oxanium text-[10px] text-pen-deep/90">
                    {details}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyDetails}
                    className={cn(
                      'absolute right-2 top-2 flex items-center gap-1 rounded-chip border border-rule-strong bg-paper-raised px-2 py-1.5 text-[10px] text-ink transition-colors hover:bg-paper-raised/70',
                      focusRing,
                    )}
                    title="Salin Error"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-seal-600" weight="bold" />
                    ) : (
                      <Copy className="h-3 w-3" weight="bold" />
                    )}
                    <span>{copied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
