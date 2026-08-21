import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  X,
} from 'lucide-react';

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
  if (!isOpen) return null;

  const handlePrintAll = () => {
    if (tokens.length === 0) return;

    const cardsHtml = tokens
      .map((tok) => {
        const cardEl = document.getElementById(`badge-card-${tok.id}`);
        const svgHtml = cardEl?.querySelector('svg')?.outerHTML || '';
        const divText = tok.member_division ? `• ${tok.member_division}` : '';
        const evText =
          eventName || tok.event_name
            ? `<div class="event-name">${eventName || tok.event_name}</div>`
            : '';
        const badgeType =
          tok.scope === 'universal' ? 'TIKET ABSENSI UNIVERSAL' : 'TIKET KHUSUS KEGIATAN';

        const isPerpetual = tok.scope === 'universal' || new Date(tok.expires_at).getFullYear() >= 2090;
        const footerText = isPerpetual
          ? 'Masa Berlaku: Permanen (Status Aktif)'
          : `Berlaku s/d: ${new Date(tok.expires_at).toLocaleDateString('id-ID')}`;

        return `
          <div class="card">
            <div class="badge">${badgeType}</div>
            <div class="name">${tok.member_name}</div>
            <div class="info">ID: ${tok.member_external_id} ${divText}</div>
            ${evText}
            <div class="qr-box">${svgHtml}</div>
            <div class="footer">${footerText}</div>
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
          <title>Cetak Lembar Tiket - ${eventName || 'AMS — Computer Community'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 8mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .grid-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-auto-rows: 84mm;
              column-gap: 8mm;
              row-gap: 8mm;
              width: 100%;
            }
            .card {
              height: 84mm;
              max-height: 84mm;
              border: 1.5px dashed #334155;
              border-radius: 14px;
              padding: 6px 12px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              background: #ffffff;
              color: #0f172a;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .badge {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0284c7;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .name {
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.2;
              margin: 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .info {
              font-size: 11px;
              color: #334155;
              font-family: monospace;
              font-weight: bold;
              margin: 2px 0 3px 0;
            }
            .event-name {
              font-size: 11px;
              font-weight: 700;
              color: #0284c7;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
              margin-bottom: 2px;
            }
            .qr-box {
              padding: 4px;
              background: #ffffff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .qr-box svg {
              width: 125px;
              height: 125px;
              display: block;
            }
            .footer {
              font-size: 10px;
              color: #64748b;
              margin-top: 3px;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-5xl h-[92vh] rounded-3xl glass-panel-elevated border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header & Sticky Action Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-white flex items-center gap-2">
              <Printer className="w-5 h-5 text-sky-400" />
              <span>Lembar Cetak Kartu QR ({tokens.length} Tiket Aktif)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Format cetak A4 presisi (6 kartu per lembar) dengan Nama Anggota di atas QR Code.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintAll}
              disabled={tokens.length === 0}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Badges Preview Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <div
            id="printable-badge-area"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {tokens.map((tok) => (
              <div
                key={tok.id}
                id={`badge-card-${tok.id}`}
                className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 p-4 flex flex-col items-center text-center relative shadow-lg"
              >
                {/* Header Tag */}
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-1">
                  {tok.scope === 'universal' ? 'Tiket Universal' : 'Tiket Khusus Kegiatan'}
                </div>

                {/* Member Name (Clearly on TOP of QR) */}
                <h4 className="font-heading font-extrabold text-base sm:text-lg text-white leading-tight">
                  {tok.member_name}
                </h4>

                {/* ID and Division */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5 mb-1.5">
                  <span className="font-bold text-sky-400">ID: {tok.member_external_id}</span>
                  {tok.member_division && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-slate-300">{tok.member_division}</span>
                    </>
                  )}
                </div>

                {/* Event Name if exists */}
                {(eventName || tok.event_name) && (
                  <p className="text-[11px] font-bold text-sky-400 truncate max-w-full mb-1">
                    {eventName || tok.event_name}
                  </p>
                )}

                {/* QR Code Container */}
                <div className="p-2 rounded-xl bg-white shadow-md flex items-center justify-center my-1">
                  <QRCodeSVG
                    value={tok.qr_token}
                    size={140}
                    level="L"
                    includeMargin={false}
                  />
                </div>

                {/* Validity Footer */}
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  {tok.scope === 'universal' || new Date(tok.expires_at).getFullYear() >= 2090
                    ? 'Masa Berlaku: Permanen (Status Aktif)'
                    : `Berlaku s/d: ${new Date(tok.expires_at).toLocaleDateString('id-ID')}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
