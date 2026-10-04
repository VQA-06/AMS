import React from 'react';
import {
  QrCode,
  UserPlus,
  Printer,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Eye,
  Trash2,
  Table as TableIcon,
  LayoutGrid,
} from 'lucide-react';
import { Event, QrToken } from '@/shared/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { BulkActionBar, BulkActionItem } from '../ui/BulkActionBar';

export interface GuestPassWorkspaceProps {
  event: Event | null;
  qrTokens: QrToken[];
  selectedTokenIds: Set<string>;
  onToggleSelectToken: (id: string) => void;
  onSelectAllTokens: () => void;
  onOpenGuestModal: () => void;
  onOpenQrModal: () => void;
  onOpenPrintSheet: () => void;
  onSelectTokenForCard: (token: QrToken) => void;
  onOpenPromoteSingle: (token: QrToken) => void;
  onOpenPromoteBulk: () => void;
  onRevokeToken: (id: string) => void;
  onRevokeTokenBatch: () => void;
  onDeleteToken: (id: string, name?: string) => void;
  onDeleteTokenBatch: () => void;
  onClearSelection?: () => void;
  isManager: boolean;
  canGenerate: boolean;
}

export const GuestPassWorkspace: React.FC<GuestPassWorkspaceProps> = ({
  event,
  qrTokens,
  selectedTokenIds,
  onToggleSelectToken,
  onSelectAllTokens,
  onOpenGuestModal,
  onOpenQrModal,
  onOpenPrintSheet,
  onSelectTokenForCard,
  onOpenPromoteSingle,
  onOpenPromoteBulk,
  onRevokeToken,
  onRevokeTokenBatch,
  onDeleteToken,
  onDeleteTokenBatch,
  onClearSelection,
  isManager,
  canGenerate,
}) => {
  const hasSelectedGuests = Array.from(selectedTokenIds).some((id) => {
    const t = qrTokens.find((tok) => tok.id === id);
    return t?.member_external_id?.startsWith('GUEST-');
  });

  const bulkActions: BulkActionItem[] = [
    {
      label: 'Cetak Terpilih',
      icon: <Printer className="w-3.5 h-3.5" />,
      variant: 'default',
      onClick: onOpenPrintSheet,
    },
    ...(hasSelectedGuests && isManager
      ? [
          {
            label: 'Angkat Jadi Anggota',
            icon: <UserCheck className="w-3.5 h-3.5" />,
            variant: 'default' as const,
            onClick: onOpenPromoteBulk,
          },
        ]
      : []),
    {
      label: 'Cabut Terpilih',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      variant: 'warning',
      onClick: onRevokeTokenBatch,
    },
    {
      label: 'Hapus Terpilih',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      variant: 'danger',
      onClick: onDeleteTokenBatch,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Workspace Header Actions */}
      <div className="p-3.5 sm:p-4 rounded-2xl glass-panel border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold font-heading text-white">Kelola Tiket QR Kegiatan</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tiket khusus yang digenerate untuk event ini atau tamu undangan sementara (guest passes).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canGenerate && (
            <Button
              variant="outline"
              size="sm"
              icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={onOpenGuestModal}
              title="Buat Tiket Tamu / Peserta Eksternal"
            >
              + Tiket Tamu (Guest)
            </Button>
          )}

          {canGenerate && event?.qr_policy === 'event_only' && (
            <Button
              variant="secondary"
              size="sm"
              icon={<QrCode className="w-3.5 h-3.5" />}
              onClick={onOpenQrModal}
              title="Generate Tiket Khusus untuk Anggota Resmi"
            >
              + Tiket Anggota
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {isManager && (
        <BulkActionBar
          selectedCount={selectedTokenIds.size}
          actions={bulkActions}
          onClearSelection={onClearSelection || onSelectAllTokens}
        />
      )}

      {/* Token List */}
      {qrTokens.length === 0 ? (
        <EmptyState
          icon={<QrCode className="w-8 h-8 text-sky-400" />}
          title="Belum Ada Tiket QR Khusus"
          description="Belum ada tiket QR khusus atau tamu yang dibuat untuk kegiatan ini. Anggota tetap bisa scan menggunakan QR Universal jika diizinkan."
          actionText={canGenerate ? 'Buat Tiket Tamu Sekarang' : undefined}
          onAction={canGenerate ? onOpenGuestModal : undefined}
        />
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  {isManager && (
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedTokenIds.size === qrTokens.length && qrTokens.length > 0}
                        onChange={onSelectAllTokens}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                        aria-label="Pilih semua tiket"
                      />
                    </th>
                  )}
                  <th className="px-5 py-3.5">ID Tiket / JTI</th>
                  <th className="px-5 py-3.5">Nama Peserta</th>
                  <th className="px-5 py-3.5">Divisi / Tipe</th>
                  <th className="px-5 py-3.5">Masa Berlaku</th>
                  <th className="px-5 py-3.5">Pemakaian</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {qrTokens.map((tok) => {
                  const isSelected = selectedTokenIds.has(tok.id);
                  const isRevoked = Boolean(tok.revoked_at);
                  const isGuest = tok.member_external_id?.startsWith('GUEST-');

                  return (
                    <tr
                      key={tok.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-sky-950/20 hover:bg-sky-950/30' : 'hover:bg-slate-900/40'
                      }`}
                    >
                      {isManager && (
                        <td className="w-10 px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelectToken(tok.id)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                            aria-label={`Pilih tiket ${tok.member_name}`}
                          />
                        </td>
                      )}
                      <td className="px-5 py-3.5 font-mono text-[11px] text-sky-400 font-oxanium">
                        {tok.jti || tok.id.slice(0, 12)}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{tok.member_name || 'Peserta'}</span>
                          {isGuest && (
                            <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 font-mono">
                              TAMU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {tok.member_division || (isGuest ? 'Tamu Undangan' : '-')}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                        {tok.expires_at ? new Date(tok.expires_at).toLocaleDateString('id-ID') : 'Perpetual'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-slate-300">
                          {tok.uses_count} {tok.max_uses !== null ? `/ ${tok.max_uses}` : ''} kali
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isRevoked ? (
                          <Badge variant="rose">DICABUT</Badge>
                        ) : (
                          <Badge variant="emerald">AKTIF</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {tok.qr_token && !isRevoked && (
                            <button
                              onClick={() => onSelectTokenForCard(tok)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-sky-950/80 hover:bg-sky-900/80 text-sky-300 border border-sky-800/60 rounded-lg transition-colors transition-transform font-semibold shadow-sm active:scale-95"
                              title="Lihat kartu atau cetak"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat</span>
                            </button>
                          )}

                          {isManager && isGuest && !isRevoked && (
                            <button
                              onClick={() => onOpenPromoteSingle(tok)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-lg transition-colors transition-transform font-semibold shadow-sm active:scale-95"
                              title="Jadikan Anggota Resmi Organisasi"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Angkat Resmi</span>
                            </button>
                          )}

                          {isManager && (
                            <>
                              {!isRevoked && (
                                <button
                                  onClick={() => onRevokeToken(tok.id)}
                                  className="px-2 py-1 text-xs text-amber-400 hover:bg-amber-950/40 rounded-lg transition-colors font-semibold"
                                  title="Cabut masa berlaku tiket"
                                >
                                  Cabut
                                </button>
                              )}
                              <button
                                onClick={() => onDeleteToken(tok.id, tok.member_name)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                                title="Hapus tiket dari event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
