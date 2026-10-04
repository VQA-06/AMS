import React from 'react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { X } from '@phosphor-icons/react/X';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';
import { TemplateIdCard } from './TemplateIdCard';

interface DigitalPassCardProps {
  tokenString: string;
  memberName: string;
  memberExternalId: string;
  memberDivision?: string | null;
  eventName?: string | null;
  scope: 'universal' | 'event';
  expiresAt: string;
  onClose?: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export const DigitalPassCard: React.FC<DigitalPassCardProps> = ({
  tokenString,
  memberName,
  memberExternalId,
  memberDivision,
  eventName,
  scope,
  expiresAt,
  onClose,
}) => {
  const isPerpetual = scope === 'universal' || new Date(expiresAt).getFullYear() >= 2090;

  // A machine surface: the payload never renders in a proportional face, and it
  // truncates rather than widening the card.
  const tokenPrefix = `${tokenString.slice(0, 12)}…${tokenString.slice(-8)}`;
  return (
    <div className="surface relative mx-auto flex w-full max-w-sm flex-col items-center rounded-panel p-3.5 text-center shadow-ambient sm:p-5">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup dialog"
          title="Tutup"
          className={cn(
            'absolute right-3 top-3 z-10 rounded-chip bg-paper-raised p-2 text-ink-2 transition-colors hover:text-ink',
            focusRing
          )}
        >
          <X size={16} />
        </button>
      )}

      {/* Scope — brass for the community-wide pass, ochre for the event-bound one. */}
      <Badge
        variant={scope === 'universal' ? 'pen' : 'pending'}
        size="sm"
        className="mb-3"
        icon={<Sparkle size={12} weight="bold" />}
      >
        {scope === 'universal' ? 'ID Card Resmi Komunitas' : 'Pass Khusus Kegiatan'}
      </Badge>

      {/* Official Template ID Card Preview */}
      <div className="mb-3 w-full">
        <TemplateIdCard
          memberName={memberName}
          qrToken={tokenString}
          memberExternalId={memberExternalId}
          memberDivision={memberDivision}
          eventName={eventName}
          scope={scope}
          expiresAt={expiresAt}
          showActions={true}
        />
      </div>

      {/* Validity readout — the machine half of the pass. */}
      <div className="surface-raised w-full space-y-2 rounded-panel p-3">
        {eventName && (
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-ink">
            <CalendarBlank size={14} className="shrink-0 text-ink-2" />
            <span className="truncate">{eventName}</span>
          </p>
        )}

        {isPerpetual ? (
          <p className="text-[11px] font-semibold text-seal-800">
            Masa Berlaku: Permanen (Status Aktif)
          </p>
        ) : (
          <p className="text-[11px] text-ink-2">
            Berlaku hingga:{' '}
            <span className="font-oxanium tabular-nums text-pending-800">
              {new Date(expiresAt).toLocaleString('id-ID')}
            </span>
          </p>
        )}

        <div className="border-t border-rule pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">
            Token
          </p>
          <p
            title={tokenString}
            className="no-scrollbar mt-1 block overflow-x-auto whitespace-nowrap font-oxanium text-[11px] leading-tight text-ink"
          >
            {tokenPrefix}
          </p>
        </div>
      </div>
    </div>
  );
};
