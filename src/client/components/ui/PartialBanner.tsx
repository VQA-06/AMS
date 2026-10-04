import React from 'react';
import { Warning } from '@phosphor-icons/react';
import { cn } from '../../lib/cn';

export interface PartialBannerProps {
  /** Labels of the sections that rejected, in declaration order. */
  sections: string[];
  onRetry?: () => void;
  className?: string;
}

/**
 * The one "some of this did not load" surface. Five pages used to hand-roll
 * it, three of them with divergent Tailwind — which is how the same message
 * ended up styled three different ways.
 *
 * `role="status" aria-live="polite"` because a partial outage is news, not an
 * interruption: it must be announced without stealing focus.
 */
export const PartialBanner: React.FC<PartialBannerProps> = ({ sections, onRetry, className }) => {
  if (sections.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-l-2 border-l-pending bg-paper-sunk px-4 py-3',
        className
      )}
    >
      <Warning size={16} weight="bold" className="shrink-0 text-pending" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink-2">
        Sebagian data gagal dimuat: {sections.join(', ')}. Angka di bawah mungkin tidak lengkap,
        bukan nol.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'shrink-0 text-[12px] font-semibold text-pen underline underline-offset-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
          )}
        >
          Coba lagi
        </button>
      )}
    </div>
  );
};