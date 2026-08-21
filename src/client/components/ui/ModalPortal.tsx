import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Enterprise-Grade Modal Portal Component
 * Mounts modal DOM nodes directly to document.body, escaping all parent
 * stacking contexts, overflow containers, and CSS transforms (e.g. MobileShell headers/sidebars).
 * Ensures 100% full-screen backdrop coverage with zero clipping or layout leaks.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
};
