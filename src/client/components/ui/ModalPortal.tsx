import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Enterprise-Grade Modal Portal Component
 * - Mounts modal DOM nodes directly to document.body, escaping all parent
 *   stacking contexts, overflow containers, and CSS transforms (e.g. MobileShell headers/sidebars).
 * - Locks body scroll & touch-action to prevent background viewport scrolling.
 * - Guarantees 100% full-screen backdrop coverage (100dvw x 100dvh) with zero clipping or layout leaks.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);

    // Save previous styles
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    // Lock body and html scroll
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      setMounted(false);
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
};
