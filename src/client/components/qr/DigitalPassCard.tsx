import React from 'react';
import {
  Calendar,
  Sparkles,
  X,
} from 'lucide-react';
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

  return (
    <div className="glass-panel-elevated rounded-3xl p-5 sm:p-6 border border-slate-700/80 shadow-2xl relative flex flex-col items-center text-center max-w-sm w-full mx-auto animate-in zoom-in-95">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors z-10"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Scope Badge */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800 mb-3">
        <Sparkles className="w-3 h-3" />
        {scope === 'universal' ? 'ID Card Resmi Komunitas' : 'Pass Khusus Kegiatan'}
      </span>

      {/* Official Template ID Card Preview */}
      <div className="w-full mb-3">
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

      {/* Event or Validity Info */}
      <div className="w-full bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 text-xs text-slate-400 space-y-1">
        {eventName && (
          <p className="flex items-center justify-center gap-1.5 text-slate-300 font-semibold truncate">
            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">{eventName}</span>
          </p>
        )}
        {isPerpetual ? (
          <p className="text-[11px] font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Masa Berlaku: Permanen (Status Aktif)</span>
          </p>
        ) : (
          <p className="text-[11px]">
            Berlaku hingga: {new Date(expiresAt).toLocaleString('id-ID')}
          </p>
        )}
      </div>
    </div>
  );
};
