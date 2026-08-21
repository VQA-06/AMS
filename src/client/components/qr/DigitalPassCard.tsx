import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Building2,
  Calendar,
  Copy,
  Check,
  Sparkles,
  Printer,
  X,
} from 'lucide-react';

interface DigitalPassCardProps {
  tokenString: string;
  memberName: string;
  memberExternalId: string;
  memberDivision?: string | null;
  eventName?: string | null;
  scope: 'universal' | 'event';
  expiresAt: string;
  onClose?: () => void;
}

export const DigitalPassCard: React.FC<DigitalPassCardProps> = ({
  tokenString,
  memberName,
  memberExternalId,
  memberDivision,
  eventName,
  scope,
  expiresAt,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(tokenString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintCard = () => {
    const svgEl = qrContainerRef.current?.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    const divText = memberDivision ? `• Divisi: ${memberDivision}` : '';
    const evText = eventName ? `<div class="event-name">Event: ${eventName}</div>` : '';

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
          <title>Cetak Kartu - ${memberName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 90vh;
              margin: 0;
              background: #ffffff;
            }
            .card {
              width: 320px;
              padding: 24px;
              background: #ffffff;
              border: 1.5px dashed #0f172a;
              border-radius: 20px;
              text-align: center;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .badge {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0284c7;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .name {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 4px 0;
              line-height: 1.2;
            }
            .info {
              font-size: 13px;
              color: #475569;
              font-family: monospace;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .event-name {
              font-size: 13px;
              font-weight: 700;
              color: #0284c7;
              margin-bottom: 8px;
            }
            .qr-box {
              padding: 12px;
              background: #ffffff;
              display: inline-block;
              margin: 6px 0;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .footer {
              font-size: 11px;
              color: #64748b;
              margin-top: 10px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">${scope === 'universal' ? 'Kartu Absensi Universal' : 'Tiket Khususs Kegiatan'}</div>
            <div class="name">${memberName}</div>
            <div class="info">ID: ${memberExternalId} ${divText}</div>
            ${evText}
            <div class="qr-box">${svgHtml}</div>
            <div class="footer">${
              scope === 'universal' || new Date(expiresAt).getFullYear() >= 2090
                ? 'Masa Berlaku: Permanen (Status Aktif)'
                : `Berlaku hingga: ${new Date(expiresAt).toLocaleString('id-ID')}`
            }</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const isPerpetual = scope === 'universal' || new Date(expiresAt).getFullYear() >= 2090;

  return (
    <div className="glass-panel-elevated rounded-3xl p-6 border border-slate-700/80 shadow-2xl relative flex flex-col items-center text-center max-w-sm w-full mx-auto animate-in zoom-in-95">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 transition-colors"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Scope Badge */}
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-950 text-sky-400 border border-sky-800 mb-3">
        <Sparkles className="w-3 h-3" />
        {scope === 'universal' ? 'Kartu Absensi Universal' : 'Tiket Khusus Kegiatan'}
      </span>

      {/* Member Details */}
      <h3 className="font-heading font-extrabold text-xl text-white tracking-tight leading-snug">
        {memberName}
      </h3>
      <p className="font-mono text-xs font-semibold text-slate-400 mt-0.5">
        ID: {memberExternalId}
      </p>
      {memberDivision && (
        <span className="mt-1.5 px-2.5 py-0.5 rounded-lg bg-slate-800 text-sky-400 text-xs font-medium border border-slate-700">
          Divisi: {memberDivision}
        </span>
      )}

      {/* QR Code */}
      <div
        ref={qrContainerRef}
        className="my-4 p-4 rounded-2xl bg-white shadow-xl flex items-center justify-center"
      >
        <QRCodeSVG
          value={tokenString}
          size={190}
          level="L"
          includeMargin={false}
        />
      </div>

      {/* Event or Validity Info */}
      <div className="w-full bg-slate-950/60 rounded-2xl p-3 border border-slate-800 text-xs text-slate-400 space-y-1 mb-4">
        {eventName && (
          <p className="flex items-center justify-center gap-1 text-slate-300 font-semibold truncate">
            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">{eventName}</span>
          </p>
        )}
        {isPerpetual ? (
          <p className="text-[11px] font-semibold text-emerald-400 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Masa Berlaku: Permanen (Status Aktif)</span>
          </p>
        ) : (
          <p className="text-[11px]">
            Berlaku hingga: {new Date(expiresAt).toLocaleString('id-ID')}
          </p>
        )}
      </div>

      {/* Action Buttons: Print / Save PDF & Copy Token */}
      <div className="grid grid-cols-2 gap-3 w-full">
        <button
          onClick={handlePrintCard}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-slate-950 transition-all shadow-lg shadow-sky-500/20 active:scale-95"
          title="Cetak kartu atau simpan sebagai PDF"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak / PDF</span>
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all shadow active:scale-95"
          title="Salin string token"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-400" />
              <span>Salin Token</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
