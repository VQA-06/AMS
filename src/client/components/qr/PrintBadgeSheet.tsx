import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  Download,
  X,
  Loader2,
  CheckCircle2,
  CreditCard,
} from 'lucide-react';
import { generateIdCardDataUrl, downloadIdCardImage } from '../../lib/idcard-canvas';

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

        return `
          <div class="id-card">
            <div class="qr-container">
              ${svgHtml}
            </div>
            <div class="name-text">${tok.member_name}</div>
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
              border-radius: 3.5mm;
              overflow: hidden;
              background-image: url('/idcard-template.png');
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
              page-break-inside: avoid;
              break-inside: avoid;
              outline: 0.5px dashed rgba(100, 116, 139, 0.4);
              outline-offset: 1px;
            }
            .qr-container {
              position: absolute;
              top: 26.5%;
              left: 28.6%;
              width: 35.5%;
              height: 22.5%;
              display: flex;
              align-items: center;
              justify-content: center;
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
              width: 84%;
              text-align: center;
              color: #ffffff;
              font-family: 'Oxanium', sans-serif;
              font-weight: 800;
              font-size: 10.5pt;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-shadow: 0 1px 2px rgba(0,0,0,0.8);
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
        // Small delay to prevent browser download throttling
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error('Error batch downloading ID cards:', err);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-5xl h-[92vh] rounded-3xl glass-panel-elevated border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 gap-3 shrink-0">
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-sky-400" />
              <span>Cetak ID Card Resmi ({tokens.length} Kartu)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ukuran fisik standar <strong className="text-sky-400 font-mono">54 mm × 85 mm</strong> (Grid A4 3×2 atau 3×3 per lembar dengan garis panduan potong).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAll}
              disabled={tokens.length === 0 || downloadingAll}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 active:scale-95 disabled:opacity-50"
              title="Unduh seluruh ID Card sebagai file gambar PNG beresolusi tinggi"
            >
              {downloadingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Mengunduh ({downloadProgress}%)</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>Unduh Semua PNG</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrintAll}
              disabled={tokens.length === 0 || downloadingAll}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Lembar A4 (54×85 mm)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable ID Cards Preview Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <div
            id="printable-badge-area"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center"
          >
            {tokens.map((tok) => (
              <div
                key={tok.id}
                id={`badge-card-${tok.id}`}
                className="relative w-full max-w-[220px] aspect-[54/85] rounded-2xl overflow-hidden shadow-xl border border-slate-700/80 bg-slate-900 select-none group"
              >
                {/* Template Background Image */}
                <img
                  src="/idcard-template.png"
                  alt="Template ID Card"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* QR Code Container in white box */}
                <div
                  className="absolute top-[26.5%] left-[28.6%] w-[35.5%] h-[22.5%] flex items-center justify-center pointer-events-auto"
                  title="QR Token"
                >
                  <QRCodeSVG
                    value={tok.qr_token}
                    size={110}
                    level="M"
                    includeMargin={false}
                    className="w-full h-full"
                  />
                </div>

                {/* Member Name in Oxanium ExtraBold */}
                <div
                  className="absolute top-[60.8%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84%] text-center text-white font-oxanium font-extrabold text-xs sm:text-sm tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate pointer-events-none"
                  title={tok.member_name}
                >
                  {tok.member_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
