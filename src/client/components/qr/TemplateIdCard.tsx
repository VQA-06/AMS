import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check } from '@phosphor-icons/react/Check';
import { Copy } from '@phosphor-icons/react/Copy';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { Printer } from '@phosphor-icons/react/Printer';
import { Spinner } from '@phosphor-icons/react/Spinner';
import { generateIdCardDataUrl, downloadIdCardImage } from '../../lib/idcard-canvas';

export interface TemplateIdCardProps {
  memberName: string;
  qrToken: string;
  memberExternalId?: string;
  memberDivision?: string | null;
  eventName?: string | null;
  scope?: 'universal' | 'event';
  expiresAt?: string;
  showActions?: boolean;
}

export const TemplateIdCard: React.FC<TemplateIdCardProps> = ({
  memberName,
  qrToken,
  memberExternalId,
  memberDivision,
  showActions = true,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = async () => {
    try {
      setDownloading(true);
      const svgEl = qrWrapperRef.current?.querySelector('svg');
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
        { name: memberName, qrToken },
        qrImgElement
      );

      downloadIdCardImage(memberName, dataUrl);
    } catch (err) {
      console.error('Error generating ID card PNG:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintSingle = () => {
    const svgEl = qrWrapperRef.current?.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    const nameLen = memberName.length;
    const printFontSize = nameLen > 24 ? '8pt' : nameLen > 18 ? '9.5pt' : nameLen > 14 ? '10.5pt' : '11.5pt';

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
          <title>ID Card - ${memberName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=Oxanium:wght@700;800&display=swap" rel="stylesheet" />
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 90vh;
              font-family: 'Oxanium', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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
              outline: 0.5px dashed rgba(100, 116, 139, 0.5);
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
              font-size: ${printFontSize};
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
          <div class="id-card">
            <div class="qr-container">
              ${svgHtml}
            </div>
            <div class="name-text">${memberName}</div>
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

  const nameLen = memberName.length;
  const textSizeClass = nameLen > 22 ? 'text-[15px]' : nameLen > 16 ? 'text-[17px]' : 'text-[19px] sm:text-[20px]';

  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto">
      {/* Visual Template Card Preview (Square / Non-rounded 54mm x 85mm ratio) */}
      <div className="relative w-full aspect-[54/85] rounded-none overflow-hidden shadow-2xl border border-rule-strong bg-paper-sunk select-none group">
        {/* Template Background Image */}
        <img
          src="/templates/idcard-template.png"
          alt="ID Card Background"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* QR Code Container perfectly centered inside the 388x388 white box (enlarged with slim gap) */}
        <div
          ref={qrWrapperRef}
          className="absolute top-[26.494%] left-[30.094%] w-[40.543%] h-[25.764%] p-[1.2%] flex items-center justify-center pointer-events-auto"
          title="QR Code Terenkripsi JWE"
        >
          <QRCodeSVG
            value={qrToken}
            size={145}
            level="M"
            includeMargin={false}
            className="w-full h-full"
          />
        </div>

        {/* Member Name with Oxanium ExtraBold (17px - 20px, Full name without clipping) */}
        <div
          className={`absolute top-[60.8%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] text-center text-white font-oxanium font-extrabold ${textSizeClass} tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] leading-tight pointer-events-none break-words`}
          title={memberName}
        >
          {memberName}
        </div>
      </div>

      {/* Meta Information Tag */}
      <div className="mt-3 flex w-full items-center justify-between px-1 text-xs text-ink-2">
        <span className="truncate font-oxanium font-bold text-ink-2">
          ID: {memberExternalId || 'AMS-MBR'}
        </span>
        {memberDivision && (
          <span className="text-ink font-medium truncate ml-2">
            • {memberDivision}
          </span>
        )}
      </div>

      {/* Action Buttons with Clean Typography */}
      {showActions && (
        <div className="grid grid-cols-3 gap-2 w-full mt-3">
          <button
            onClick={handleDownloadPng}
            disabled={downloading}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-chip bg-pen-500 px-2 py-2.5 text-xs font-bold text-paper shadow-ambient transition-transform duration-120 ease-spring active:scale-95 hover:bg-pen-400 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            title="Unduh ID Card gambar PNG HD"
          >
            {downloading ? (
              <Spinner className="shrink-0 animate-spin" />
            ) : (
              <DownloadSimple className="size-3.5 shrink-0" />
            )}
            <span className="truncate">Unduh</span>
          </button>

          <button
            onClick={handlePrintSingle}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-chip border border-rule-strong bg-paper-raised px-2 py-2.5 text-xs font-bold text-ink transition-transform duration-120 ease-spring hover:bg-paper-raised/70 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            title="Cetak ID Card ukuran 54x85 mm"
          >
            <Printer size={14} className="shrink-0 text-ink-2" />
            <span className="truncate">Cetak</span>
          </button>

          <button
            onClick={handleCopyToken}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-chip border border-rule bg-ink px-2 py-2.5 text-xs font-bold text-paper transition-transform duration-120 ease-spring hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            title="Salin token QR"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-seal-600 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-ink-2 shrink-0" />
            )}
            <span className="truncate">{copied ? 'Tersalin' : 'Salin'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
