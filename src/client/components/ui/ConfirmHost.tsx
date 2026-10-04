import React, { useCallback, useRef, useState } from 'react';
import { ConfirmModal, type ModalType } from './ConfirmModal';
import { AlertModal, type AlertType } from './AlertModal';

/**
 * The one owner of confirm/alert state.
 *
 * Four pages used to keep `confirmDialog`/`alertModal` object pairs in
 * `useState` and hand-roll the markup — ~26 near-identical sites, and 18
 * `modal-backdrop-full` backdrops to keep consistent. Here a caller writes
 * `if (!(await confirm({...}))) return;` and the modal's lifetime, focus
 * behavior and Escape rules come from `ModalPortal`, which is not reimplemented.
 */

interface ConfirmRequest {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ModalType;
  onConfirm?: () => void | Promise<void>;
}

interface AlertRequest {
  title: string;
  body: React.ReactNode;
  label?: string;
  tone?: AlertType;
}

type ConfirmResolver = (value: boolean) => void;
type AlertResolver = () => void;

export interface ConfirmHost {
  /** Resolves `true` when the user confirms, `false` on cancel or Escape. */
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  /** Resolves when the user dismisses. */
  alert: (request: AlertRequest) => Promise<void>;
  /** Render once inside the page root. */
  dialogs: React.ReactNode;
}

export function useConfirmHost(): ConfirmHost {
  const [confirmState, setConfirmState] = useState<
    (ConfirmRequest & { resolve: ConfirmResolver }) | null
  >(null);
  const [alertState, setAlertState] = useState<
    (AlertRequest & { resolve: AlertResolver }) | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // The in-flight confirm's async action is held in a ref, not state: setting
  // state would re-render and could re-enter the handler mid-flight.
  const confirmAction = useRef<(() => void | Promise<void>) | undefined>(undefined);

  const confirm = useCallback((request: ConfirmRequest) => {
    confirmAction.current = request.onConfirm;
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...request, resolve });
    });
  }, []);

  const alert = useCallback((request: AlertRequest) => {
    return new Promise<void>((resolve) => {
      setAlertState({ ...request, resolve });
    });
  }, []);

  const closeConfirm = useCallback(
    (result: boolean) => {
      setConfirmState((current) => {
        current?.resolve(result);
        return null;
      });
      setConfirmBusy(false);
      if (!result) confirmAction.current = undefined;
    },
    []
  );

  const handleConfirmClick = useCallback(async () => {
    const action = confirmAction.current;
    if (!action) {
      closeConfirm(true);
      return;
    }
    setConfirmBusy(true);
    try {
      await action();
      closeConfirm(true);
    } catch {
      // The action failed. Keep the dialog open so the caller can surface the
      // error instead of silently reporting success.
      setConfirmBusy(false);
    }
  }, [closeConfirm]);

  const dialogs = (
    <>
      {confirmState && (
        <ConfirmModal
          isOpen
          title={confirmState.title}
          message={confirmState.body}
          type={confirmState.tone ?? 'danger'}
          confirmText={confirmState.confirmLabel ?? 'Konfirmasi'}
          cancelText={confirmState.cancelLabel ?? 'Batal'}
          loading={confirmBusy}
          onConfirm={handleConfirmClick}
          onClose={() => closeConfirm(false)}
        />
      )}
      {alertState && (
        <AlertModal
          isOpen
          title={alertState.title}
          message={alertState.body}
          type={alertState.tone ?? 'info'}
          buttonText={alertState.label ?? 'Mengerti'}
          onClose={() =>
            setAlertState((current) => {
              current?.resolve();
              return null;
            })
          }
        />
      )}
    </>
  );

  return { confirm, alert, dialogs };
}