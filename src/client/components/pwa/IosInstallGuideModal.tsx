import React from 'react';
import { ArrowDown } from '@phosphor-icons/react/ArrowDown';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { DeviceMobile } from '@phosphor-icons/react/DeviceMobile';
import { PlusSquare } from '@phosphor-icons/react/PlusSquare';
import { ShareNetwork } from '@phosphor-icons/react/ShareNetwork';
import { X } from '@phosphor-icons/react/X';
import { ModalPortal } from '../ui/ModalPortal';
import { Button } from '../ui/Button';

interface IosInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  title: React.ReactNode;
  detail: React.ReactNode;
  icon: React.ReactNode;
}

/**
 * A numbered procedure. Every step carries its number in text as well as in the
 * marker badge, so the sequence survives with the icons stripped and reads
 * correctly under a screen reader. `aria-current="step"` marks the first
 * unverified step — the whole list is currently unverified, so that is step one
 * rather than an arbitrary middle entry.
 */
const STEPS: GuideStep[] = [
  {
    title: (
      <>
        Tekan tombol <strong className="font-bold text-ink">Bagikan (Share)</strong>
      </>
    ),
    detail: 'Buka menu bagikan di bilah navigasi Safari bagian bawah layar.',
    icon: <ShareNetwork size={14} className="text-ink-2" aria-hidden="true" />,
  },
  {
    title: (
      <>
        Pilih <strong className="font-bold text-ink">Tambahkan ke Layar Utama</strong>
      </>
    ),
    detail: (
      <>
        Gulir ke bawah pada menu bagikan dan pilih <em>&quot;Add to Home Screen&quot;</em>.
      </>
    ),
    icon: <PlusSquare size={14} className="text-ink-2" aria-hidden="true" />,
  },
  {
    title: (
      <>
        Tekan <strong className="font-bold text-ink">Tambah (Add)</strong> di pojok kanan atas
      </>
    ),
    detail: 'Ikon AMS akan muncul di layar utama perangkat Anda.',
    icon: <ArrowDown size={14} className="text-ink-2" aria-hidden="true" />,
  },
];

export const IosInstallGuideModal: React.FC<IosInstallGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    /* Escape, the scroll lock and the focus trap all belong to ModalPortal. */
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop-full">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-guide-title"
          className="bezel relative my-auto flex w-full max-w-sm flex-col gap-5 p-6"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="absolute right-3 top-3 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-chip text-ink-2 transition-colors hover:bg-paper-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <X size={16} aria-hidden="true" />
          </button>

          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-panel border border-rule bg-paper object-contain">
              <img src="/logo.webp" alt="" className="h-full w-full object-contain" />
            </div>
            <h3 id="ios-install-guide-title" className="font-heading text-base font-bold text-ink">
              Pasang AMS | Computer Community di iOS
            </h3>
            <p className="text-xs leading-relaxed text-ink-2">
              Dapatkan pengalaman aplikasi mandiri (*full screen*), pemindai QR lebih cepat, dan akses
              instan tanpa bilah browser.
            </p>
          </div>

          {/* Steps: an ordered list, so the sequence is in the markup, not in the
              visual order of flex children. */}
          <ol className="surface-raised space-y-3 rounded-panel border border-rule p-4 text-xs">
            {STEPS.map((step, idx) => (
              <li
                key={idx}
                aria-current={idx === 0 ? 'step' : undefined}
                className="flex items-start gap-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip border border-pen-200 bg-pen-50/70 font-oxanium text-[11px] font-bold tabular-nums text-ink-2">
                  {/* Step number as text: the sequence never depends on the icon. */}
                  <span aria-hidden="true">{idx + 1}</span>
                  <span className="sr-only">
                    Langkah {idx + 1} dari {STEPS.length}
                  </span>
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                    <span>{step.title}</span>
                    {step.icon}
                  </p>
                  <p className="text-[11px] text-ink-2">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex items-start gap-2 rounded-panel border border-rule bg-paper-raised/60 px-3 py-2.5">
            <CheckCircle size={16} className="mt-0.5 shrink-0 text-seal-600" aria-hidden="true" />
            <p className="text-[11px] text-ink-2">
              Aplikasi AMS siap dibuka langsung dari Home Screen perangkat Anda!
            </p>
          </div>

          <Button variant="primary" size="md" onClick={onClose}>
            Mengerti
          </Button>
        </div>
      </div>
    </ModalPortal>
  );
};