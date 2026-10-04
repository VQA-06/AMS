import React from 'react';
import { X } from '@phosphor-icons/react/X';
import { cn } from '../../lib/cn';
import { ModalPortal } from './ModalPortal';
import { Button } from './Button';

export type ModalType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

/**
 * A confirm panel is the one place a constant rail is legitimate: the rail's
 * hue *is* the panel's type, and the confirm button's own `variant` changes
 * with it, so the destructive action can never be mistaken for the safe one.
 */
const PANEL: Record<ModalType, { rail: string; confirm: 'danger' | 'primary' | 'outline' }> = {
  danger: { rail: 'bg-pen-500', confirm: 'danger' },
  warning: { rail: 'bg-pending-500', confirm: 'primary' },
  success: { rail: 'bg-seal-500', confirm: 'primary' },
  info: { rail: 'bg-info', confirm: 'outline' },
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  type = 'danger',
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  onConfirm,
  onClose,
  loading = false,
}) => {
  // Escape, focus capture/restore, and the Tab trap are centralized in
  // ModalPortal. Dismissal stays disabled while `loading` so a destructive
  // confirm cannot be abandoned mid-request (see dismissOnEscape below).

  if (!isOpen) return null;

  const panel = PANEL[type];

  return (
    <ModalPortal onClose={onClose} dismissOnEscape={!loading}>
      <div className="modal-backdrop-full">
        <div
          role="dialog"
          aria-modal="true"
          className="bezel relative my-auto flex w-full max-w-md flex-col gap-4 p-5 text-ink sm:gap-5 sm:p-6"
        >
          <span aria-hidden="true" className={cn('rail absolute bottom-6 left-0 top-6', panel.rail)} />
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="Tutup dialog"
            className={cn(
              'absolute right-3 top-3 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-chip text-ink-2 transition-colors hover:text-ink disabled:opacity-50',
              focusRing
            )}
          >
            <X size={16} />
          </button>

          <div className="pr-8">
            <h3 className="font-heading text-base font-bold leading-snug text-ink">{title}</h3>
            <div className="mt-1 break-words text-xs leading-relaxed text-ink">{message}</div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-rule pt-4">
            <Button variant="secondary" size="md" disabled={loading} onClick={onClose}>
              {cancelText}
            </Button>
            <Button variant={panel.confirm} size="md" disabled={loading} onClick={onConfirm}>
              {loading ? 'Memproses…' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
