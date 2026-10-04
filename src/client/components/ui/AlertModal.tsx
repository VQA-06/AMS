import React, { useEffect } from 'react';
import { X } from '@phosphor-icons/react/X';
import { cn } from '../../lib/cn';
import { ModalPortal } from './ModalPortal';
import { Button } from './Button';

/**
 * Deliberately narrow: there is no `danger` member, so a caller cannot widen
 * the union and render an error through a hue that means something else.
 */
export type AlertType = 'error' | 'success' | 'info' | 'warning';

export interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  type?: AlertType;
  buttonText?: string;
  onClose: () => void;
}

const PANEL: Record<AlertType, { rail: string; action: 'danger' | 'primary' | 'outline' }> = {
  error: { rail: 'bg-pen-500', action: 'danger' },
  warning: { rail: 'bg-pending-500', action: 'primary' },
  success: { rail: 'bg-seal-500', action: 'primary' },
  info: { rail: 'bg-info', action: 'outline' },
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  type = 'error',
  buttonText = 'Mengerti',
  onClose,
}) => {
  // Escape is handled centrally by ModalPortal; this only adds Enter-to-dismiss.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const panel = PANEL[type];

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop-full">
        <div
          role="dialog"
          aria-modal="true"
          className="bezel relative my-auto flex w-full max-w-md flex-col gap-4 p-5 text-ink sm:gap-5 sm:p-6"
        >
          <span aria-hidden="true" className={cn('rail absolute bottom-6 left-0 top-6', panel.rail)} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className={cn(
              'absolute right-3 top-3 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-chip text-ink-2 transition-colors hover:text-white',
              focusRing
            )}
          >
            <X size={16} />
          </button>

          <div className="pr-8">
            <h3 className="font-heading text-base font-bold leading-snug text-white">{title}</h3>
            <div className="mt-1 break-words text-xs leading-relaxed text-ink">{message}</div>
          </div>

          <div className="flex items-center justify-end border-t border-rule pt-4">
            <Button variant={panel.action} size="md" onClick={onClose}>
              {buttonText}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
