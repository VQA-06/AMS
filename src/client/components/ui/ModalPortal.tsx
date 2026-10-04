import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
  /**
   * Invoked when the user presses Escape. Omit for modals that must not be
   * dismissed by keyboard (e.g. a blocking confirmation mid-write).
   */
  onClose?: () => void;
  /** Disables Escape dismissal regardless of `onClose`. */
  dismissOnEscape?: boolean;
}

/** Focusable selector used to move focus into, cycle within, and restore it. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Modal Portal.
 *
 * - Mounts modal DOM directly to document.body, escaping parent stacking
 *   contexts, overflow containers, and CSS transforms (e.g. MobileShell
 *   headers/sidebars).
 * - Locks body scroll & touch-action to prevent background viewport scrolling,
 *   refcounted so nested/stacked modals restore correctly.
 * - Escape dismisses the modal, Tab cycles inside it, focus is captured on
 *   open and returned to the invoking control on close, and the background is
 *   hidden from assistive tech.
 *
 * The a11y behavior lives here rather than per modal because every consumer
 * renders its own markup and previously each had to reimplement it — 5 of
 * them shipped with no Escape handling at all.
 */
let activeModalCount = 0;
let originalBodyOverflow = '';
let originalBodyTouchAction = '';
let originalHtmlOverflow = '';

export const ModalPortal: React.FC<ModalPortalProps> = ({
  children,
  onClose,
  dismissOnEscape = true,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);

    // Remember the invoking control so focus can be returned on close.
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    if (activeModalCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalBodyTouchAction = document.body.style.touchAction;
      originalHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
    }
    activeModalCount++;

    // Hide the background from assistive tech while a dialog is open.
    document.getElementById('root')?.setAttribute('aria-hidden', 'true');

    return () => {
      setMounted(false);
      activeModalCount--;
      if (activeModalCount <= 0) {
        activeModalCount = 0;
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.touchAction = originalBodyTouchAction;
        document.documentElement.style.overflow = originalHtmlOverflow;

        // The dialog mounts into document.body, so marking the app root
        // aria-hidden hides the background from assistive tech without
        // touching the dialog itself.
        document.getElementById('root')?.removeAttribute('aria-hidden');
      }

      // Return focus to whatever opened the modal.
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Escape to dismiss; Tab is trapped inside the panel so focus cannot wander
  // into the inert background.
  useEffect(() => {
    if (!onClose || !dismissOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (activeEl === first || !panel.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, dismissOnEscape]);

  // Move focus into the dialog on open.
  useEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    if (!panel) return;

    const target =
      panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target.focus({ preventScroll: true });
  }, [mounted]);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="contents"
    >
      {children}
    </div>,
    document.body
  );
};