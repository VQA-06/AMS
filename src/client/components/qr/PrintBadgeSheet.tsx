import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CreditCard } from '@phosphor-icons/react/CreditCard';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { Printer } from '@phosphor-icons/react/Printer';
import { Spinner } from '@phosphor-icons/react/Spinner';
import { X } from '@phosphor-icons/react/X';
import { generateIdCardDataUrl, downloadIdCardImage } from '../../lib/idcard-canvas';
import { ModalPortal } from '../ui/ModalPortal';
import { cn } from '../../lib/cn';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export interface PrintableToken {
  id: string;
  member_id: string;
  member_name: string;
  member_external_id: string;
  member_division?: string | null;
  qr_token: string;
  scope: 'universal' | 'event';
  expires_at: string;
  event_name?: string | null;
}

interface PrintBadgeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: PrintableToken[];
  eventName?: string | null;
}

export const PrintBadgeSheet: React.FC<PrintBadgeSheetProps> = ({
  isOpen,
  onClose,
  tokens,
  eventName,
}) => {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  if (!isOpen) return null;

  const handlePrintAll = () => {
    if (tokens.length === 0) return;

    const cardsHtml = tokens
      .map((tok) => {
        const cardEl = document.getElementById(`badge-card-${tok.id}`);
        const svgHtml = cardEl?.querySelector('svg')?.outerHTML || '';
        
        // Dynamically compute print font size based on name length to prevent clipping
        const nameLen = tok.member_name.length;
        const printFontSize = nameLen > 24 ? '8pt' : nameLen > 18 ? '9.5pt' : nameLen > 14 ? '10.5pt' : '11.5pt';

        return `
          <div class="id-card">
            <div class="qr-container">
              ${svgHtml}
            </div>
            <div class="name-text" style="font-size: ${printFontSize};">${tok.member_name}</div>
          </div>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cetak ID Card (${tokens.length} Kartu) - ${eventName || 'AMS Computer Community'}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=Oxanium:wght@700;800&display=swap" rel="stylesheet" />
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-family: 'Oxanium', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(3, 54mm);
              grid-auto-rows: 85mm;
              column-gap: 8mm;
              row-gap: 8mm;
              width: 100%;
              justify-content: center;
            }
            .id-card {
              position: relative;
              width: 54mm;
              height: 85mm;
              max-width: 54mm;
              max-height: 85mm;
              border-radius: 0 !important;
              overflow: hidden;
              background-image: url('/templates/idcard-template.png');
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
              page-break-inside: avoid;
              break-inside: avoid;
              outline: 0.6pt solid #000;
            }
            .qr-container {
              position: absolute;
              top: 26.494%;
              left: 30.094%;
              width: 40.543%;
              height: 25.764%;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 1.2%;
              box-sizing: border-box;
            }
            .qr-container svg {
              width: 100%;
              height: 100%;
              display: block;
            }
            .name-text {
              position: absolute;
              top: 60.8%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 94%;
              text-align: center;
              color: #ffffff;
              font-family: 'Oxanium', sans-serif;
              font-weight: 800;
              line-height: 1.15;
              max-height: 2.3em;
              display: flex;
              align-items: center;
              justify-content: center;
              word-break: break-word;
              overflow: hidden;
              text-shadow: 0 1px 3px rgba(0,0,0,0.95);
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${cardsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadAll = async () => {
    if (tokens.length === 0 || downloadingAll) return;

    try {
      setDownloadingAll(true);
      setDownloadProgress(0);

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        const cardEl = document.getElementById(`badge-card-${tok.id}`);
        const svgEl = cardEl?.querySelector('svg');
        let qrImgElement: HTMLImageElement | undefined;

        if (svgEl) {
          const svgString = new XMLSerializer().serializeToString(svgEl);
          const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
          qrImgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = svgDataUrl;
          });
        }

        const dataUrl = await generateIdCardDataUrl(
          { name: tok.member_name, qrToken: tok.qr_token },
          qrImgElement
        );

        downloadIdCardImage(tok.member_name, dataUrl);
        setDownloadProgress(Math.round(((i + 1) / tokens.length) * 100));
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error('Error batch downloading ID cards:', err);
    } finally {
      setDownloadingAll(false);
    }
  };
  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop-full">
        <div className="surface my-auto flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-bezel sm:h-[90vh]">
          {/* Top header & action controls */}
          <div className="flex shrink-0 flex-col gap-3 border-b border-rule bg-paper-raised p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 font-heading text-base font-bold text-ink sm:text-lg">
                <CreditCard size={20} className="shrink-0 text-ink-2" />
                <span className="truncate">Cetak ID Card Resmi ({tokens.length} Kartu)</span>
              </h3>
              <p className="mt-0.5 text-xs text-ink-2">
                Ukuran fisik standar{' '}
                <strong className="font-oxanium tabular-nums text-ink-2">54 mm × 85 mm</strong>{' '}
                (Sudut persegi/kotak tanpa potongan elipsis).
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={tokens.length === 0 || downloadingAll}
                title="Unduh seluruh ID Card sebagai file gambar PNG beresolusi tinggi"
                className={cn(
                  'flex min-h-[44px] items-center gap-1.5 rounded-chip border border-rule-strong bg-paper-raised px-3.5 text-xs font-bold text-ink transition-colors hover:bg-paper-raised/70 active:scale-95 disabled:opacity-50 sm:px-4',
                  focusRing
                )}
              >
                {downloadingAll ? (
                  <>
                    <Spinner size={16} weight="bold" className="animate-spin text-ink-2" />
                    <span>Mengunduh ({downloadProgress}%)</span>
                  </>
                ) : (
                  <>
                    <DownloadSimple size={16} className="text-ink-2" />
                    <span>Unduh Semua PNG</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrintAll}
                disabled={tokens.length === 0 || downloadingAll}
                className={cn(
                  'flex min-h-[44px] items-center gap-1.5 rounded-chip bg-pen-500 px-4 text-xs font-bold text-paper transition-colors hover:bg-pen-400 active:scale-95 disabled:opacity-50 sm:px-5',
                  focusRing
                )}
              >
                <Printer size={16} weight="bold" />
                <span>Cetak Lembar A4 (54×85 mm)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup dialog"
                className={cn(
                  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-chip bg-paper-raised text-ink-2 transition-colors hover:text-ink',
                  focusRing
                )}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable card preview grid — preview is ink-neutral on purpose: the
              template art carries the brand, and the frame carries geometry. */}
          <div className="no-scrollbar flex-1 touch-auto overscroll-contain overflow-y-auto bg-ink p-4 sm:p-6">
            <div
              id="printable-badge-area"
              className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
              {tokens.map((tok) => {
                const nameLen = tok.member_name.length;
                const textSizeClass =
                  nameLen > 22 ? 'text-[13px]' : nameLen > 16 ? 'text-[15px]' : 'text-[17px]';

                return (
                  <figure
                    key={tok.id}
                    id={`badge-card-${tok.id}`}
                    className="relative aspect-[54/85] w-full max-w-[220px] select-none overflow-hidden rounded-none border border-rule-strong bg-paper"
                  >
                    {/* Template background image */}
                    <img
                      src="/templates/idcard-template.png"
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    />

                    {/* QR code, centered in the template's 388×388 white box */}
                    <div
                      className="pointer-events-auto absolute left-[30.094%] top-[26.494%] flex h-[25.764%] w-[40.543%] items-center justify-center p-[1.2%]"
                      title="QR Token"
                    >
                      <QRCodeSVG
                        value={tok.qr_token}
                        size={110}
                        level="M"
                        includeMargin={false}
                        className="h-full w-full"
                      />
                    </div>

                    {/* Member name — weight and size carry the hierarchy, not hue,
                        so the sheet stays readable in black and white. */}
                    <figcaption
                      className={cn(
                        'pointer-events-none absolute left-1/2 top-[60.8%] w-[92%] -translate-x-1/2 -translate-y-1/2 break-words text-center font-oxanium font-extrabold leading-tight tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]',
                        textSizeClass
                      )}
                      title={tok.member_name}
                    >
                      {tok.member_name}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );

};
