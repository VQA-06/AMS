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
import { RowList, type RowListItem } from '../ui/RowList';
import { RowActions, type RowActionItem } from '../ui/RowActions';
import { EmptyState } from '../ui/EmptyState';
import { BulkActionBar, BulkActionItem } from '../ui/BulkActionBar';
import { cn } from '../../lib/cn';

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
  onOpenConvertCandidateSingle?: (token: QrToken) => void;
  onOpenConvertCandidateBulk?: () => void;
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
  onOpenConvertCandidateSingle,
  onOpenConvertCandidateBulk,
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
    ...(hasSelectedGuests && isManager && onOpenConvertCandidateBulk
      ? [
          {
            label: 'Jadikan Calon Anggota',
            icon: <UserPlus className="w-3.5 h-3.5" />,
            variant: 'default' as const,
            onClick: onOpenConvertCandidateBulk,
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

  /** One focus quartet. Never `focus:outline-none` alone. */
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500 ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

  const items: RowListItem[] = qrTokens.map((tok) => {
    const isRevoked = Boolean(tok.revoked_at);
    const isGuest = tok.member_external_id?.startsWith('GUEST-');
    const name = tok.member_name || 'Peserta';

    // The old `TAMU` chip had no slot in the index-card grammar, so the same
    // word leads the meta string instead — nothing it said is lost. The mark
    // hue stays the row's only colour carrier.
    const meta = [
      isGuest ? 'TAMU' : null,
      tok.member_external_id || tok.jti || tok.id.slice(0, 12),
      tok.member_division || (isGuest ? 'Tamu Undangan' : '-'),
      tok.expires_at ? new Date(tok.expires_at).toLocaleDateString('id-ID') : 'Perpetual',
      `${tok.uses_count}${tok.max_uses !== null ? ` / ${tok.max_uses}` : ''} kali`,
    ]
      .filter(Boolean)
      .join('  ·  ');

    const menuItems: RowActionItem[] = [
      ...(tok.qr_token && !isRevoked
        ? [
            {
              label: `Lihat Pass QR`,
              icon: <Eye size={14} />,
              onSelect: () => onSelectTokenForCard(tok),
            },
          ]
        : []),
      ...(isManager && isGuest && !isRevoked && onOpenConvertCandidateSingle
        ? [
            {
              label: `Jadikan Calon`,
              icon: <UserPlus size={14} />,
              onSelect: () => onOpenConvertCandidateSingle(tok),
            },
          ]
        : []),
      ...(isManager && !isRevoked
        ? [
            {
              label: `Cabut Tiket`,
              icon: <ShieldWarning size={14} />,
              onSelect: () => onRevokeToken(tok.id),
              tone: 'danger' as const,
            },
          ]
        : []),
      ...(isManager
        ? [
            {
              label: `Hapus Tiket`,
              icon: <Trash size={14} />,
              onSelect: () => onDeleteToken(tok.id, tok.member_name),
              tone: 'danger' as const,
            },
          ]
        : []),
    ];

    return {
      id: tok.id,
      title: name,
      meta,
      status: {
        // Load-bearing: `RowList` emits this word as `data-mark`, which the
        // colour-semantics test reads.
        label: isRevoked ? 'Dicabut' : 'Aktif',
        tone: isRevoked ? ('pen' as const) : ('seal' as const),
      },
      action: (
        <span className="flex items-center gap-1">
          {/* Desktop keeps the inline cluster; below `sm` the same actions live
              in the kebab, because four 44px targets do not fit a 344px row. */}
          <span className="hidden items-center gap-1 sm:flex">
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

            {isManager && isGuest && !isRevoked && onOpenConvertCandidateSingle && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenConvertCandidateSingle(tok)}
                icon={<UserPlus size={14} />}
                title="Jadikan Calon Anggota"
              >
                Jadikan Calon
              </Button>
            )}

            {isManager && !isRevoked && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRevokeToken(tok.id)}
                title="Cabut masa berlaku tiket"
              >
                Cabut
              </Button>
            )}

            {isManager && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteToken(tok.id, tok.member_name)}
                aria-label={`Hapus tiket ${tok.member_name || ''}`}
                title="Hapus tiket dari event"
                className={cn(focusRing, 'text-pen-deep')}
              >
                <Trash size={14} className="text-pen-deep" />
              </Button>
            )}
          </span>
          <RowActions
            className="sm:hidden"
            label={`Menu aksi ${name}`}
            items={menuItems}
          />
        </span>
      ),
    };
  });

  return (
    <div className="space-y-4">
      {/* Workspace Header Actions */}
      <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-panel p-3.5 sm:p-4">
        <div>
          <h2 className="font-heading text-sm font-bold text-ink">Kelola Tiket QR Kegiatan</h2>
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

      {/* Token List — the index-card grammar, not a `<Table>`: these are
          same-shaped records with per-row actions, so MemberList and EventList
          already own this surface and a seven-column table reads as a
          different app. */}
      <RowList
        items={items}
        selectable={isManager}
        selectedIds={selectedTokenIds}
        onToggle={onToggleSelectToken}
        onToggleAll={onSelectAllTokens}
        itemLabel="tiket"
        emptyState={
          <EmptyState
            icon={<QrCode size={32} className="text-ink-2" />}
            title="Belum Ada Tiket QR Khusus"
            description="Belum ada tiket QR khusus atau tamu yang dibuat untuk kegiatan ini. Anggota tetap bisa scan menggunakan QR Universal jika diizinkan."
            actionText={canGenerate ? 'Buat Tiket Tamu Sekarang' : undefined}
            onAction={canGenerate ? onOpenGuestModal : undefined}
          />
        }
      />
    </div>
  );
};
