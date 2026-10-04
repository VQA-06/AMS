import React from 'react';
import { Eye } from '@phosphor-icons/react/Eye';
import { Printer } from '@phosphor-icons/react/Printer';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { ShieldWarning } from '@phosphor-icons/react/ShieldWarning';
import { SquaresFour } from '@phosphor-icons/react/SquaresFour';
import { Table as TableIcon } from '@phosphor-icons/react/Table';
import { Trash } from '@phosphor-icons/react/Trash';
import { UserCheck } from '@phosphor-icons/react/UserCheck';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Event, QrToken } from '@/shared/types';
import { Button } from '../ui/Button';
import { Table, THead, TBody, TRow, TCell } from '../ui/Table';
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
      icon: <ShieldWarning className="w-3.5 h-3.5" />,
      variant: 'warning',
      onClick: onRevokeTokenBatch,
    },
    {
      label: 'Hapus Terpilih',
      icon: <Trash className="w-3.5 h-3.5" />,
      variant: 'danger',
      onClick: onDeleteTokenBatch,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Workspace Header Actions */}
      <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-panel p-3.5 shadow-ambient sm:p-4">
        <div>
          <h2 className="font-heading text-sm font-bold text-white">Kelola Tiket QR Kegiatan</h2>
          <p className="mt-0.5 text-[11px] text-ink-2">
            Tiket khusus yang digenerate untuk event ini atau tamu undangan sementara (guest passes).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canGenerate && (
            <Button
              variant="outline"
              size="sm"
              icon={<UserPlus size={14} />}
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
              icon={<QrCode size={14} />}
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
          icon={<QrCode size={32} className="text-ink-2" />}
          title="Belum Ada Tiket QR Khusus"
          description="Belum ada tiket QR khusus atau tamu yang dibuat untuk kegiatan ini. Anggota tetap bisa scan menggunakan QR Universal jika diizinkan."
          actionText={canGenerate ? 'Buat Tiket Tamu Sekarang' : undefined}
          onAction={canGenerate ? onOpenGuestModal : undefined}
        />
      ) : (
        <Table>
          <THead>
            <tr>
              {isManager && (
                <TCell header className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={
                      selectedTokenIds.size === qrTokens.length && qrTokens.length > 0
                    }
                    onChange={onSelectAllTokens}
                    className="h-4 w-4 cursor-pointer rounded border-rule-strong bg-paper-raised accent-pen-500"
                    aria-label="Pilih semua tiket"
                  />
                </TCell>
              )}
              <TCell header>ID Tiket / JTI</TCell>
              <TCell header>Nama Peserta</TCell>
              <TCell header>Divisi / Tipe</TCell>
              <TCell header>Masa Berlaku</TCell>
              <TCell header>Pemakaian</TCell>
              <TCell header>Status</TCell>
              <TCell header className="text-right">Aksi</TCell>
            </tr>
          </THead>
          <TBody>
            {qrTokens.map((tok) => {
              const isSelected = selectedTokenIds.has(tok.id);
              const isRevoked = Boolean(tok.revoked_at);
              const isGuest = tok.member_external_id?.startsWith('GUEST-');

              return (
                <TRow key={tok.id} selected={isSelected}>
                  {isManager && (
                    <TCell className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectToken(tok.id)}
                        className="h-4 w-4 cursor-pointer rounded border-rule-strong bg-paper-raised accent-pen-500"
                        aria-label={`Pilih tiket ${tok.member_name}`}
                      />
                    </TCell>
                  )}
                  <TCell className="font-oxanium text-[11px] text-ink-2">
                    {tok.jti || tok.id.slice(0, 12)}
                  </TCell>
                  <TCell className="font-semibold text-white" truncate>
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{tok.member_name || 'Peserta'}</span>
                      {isGuest && (
                        <span className="shrink-0 rounded border border-pending-200 bg-pending-50 px-1.5 py-0.5 font-oxanium text-[10px] text-pending-800">
                          TAMU
                        </span>
                      )}
                    </span>
                  </TCell>
                  <TCell className="text-ink-2">
                    {tok.member_division || (isGuest ? 'Tamu Undangan' : '-')}
                  </TCell>
                  <TCell className="font-oxanium text-[11px] text-ink-2">
                    {tok.expires_at
                      ? new Date(tok.expires_at).toLocaleDateString('id-ID')
                      : 'Perpetual'}
                  </TCell>
                  <TCell className="font-oxanium text-ink">
                    {tok.uses_count} {tok.max_uses !== null ? `/ ${tok.max_uses}` : ''} kali
                  </TCell>
                  <TCell>
                    {/* The rail already encodes live vs revoked, so the text label
                        is all that is left to say here. */}
                    {isRevoked ? (
                      <span className="font-oxanium text-xs font-bold text-pen-deep">
                        DICABUT
                      </span>
                    ) : (
                      <span className="font-oxanium text-xs font-bold text-ink">
                        AKTIF
                      </span>
                    )}
                  </TCell>
                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {tok.qr_token && !isRevoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectTokenForCard(tok)}
                          icon={<Eye size={14} />}
                          title="Lihat kartu digital"
                        >
                          Lihat
                        </Button>
                      )}

                      {isManager && isGuest && !isRevoked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenPromoteSingle(tok)}
                          icon={<UserCheck size={14} />}
                          title="Jadikan Anggota Resmi Organisasi"
                        >
                          Angkat Resmi
                        </Button>
                      )}

                      {isManager && (
                        <>
                          {!isRevoked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRevokeToken(tok.id)}
                              title="Cabut masa berlaku tiket"
                            >
                              Cabut
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteToken(tok.id, tok.member_name)}
                            aria-label={`Hapus tiket ${tok.member_name || ''}`}
                            title="Hapus tiket dari event"
                          >
                            <Trash size={14} className="text-pen" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TCell>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
};
