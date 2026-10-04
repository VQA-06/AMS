import React from 'react';
import { Eye } from '@phosphor-icons/react/Eye';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Trash } from '@phosphor-icons/react/Trash';
import { User } from '@phosphor-icons/react/User';
import { Member } from '@/shared/types';
import { cn } from '../../lib/cn';
import { EmptyState } from '../ui/EmptyState';
import { RowList, type RowListItem } from '../ui/RowList';

interface MemberListProps {
  members: Member[];
  loading?: boolean;
  onEdit: (member: Member) => void;
  onDelete: (id: string, name: string) => void;
  onViewPass: (member: Member) => void;
  canManage?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
}

/** One focus quartet. Never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const iconButtonClass = (tone: 'pen' | 'neutral' | 'danger') =>
  cn(
    'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-chip transition-colors duration-120 ease-out-expo',
    focusRing,
    tone === 'pen' && 'text-pen hover:bg-pen-50/70',
    tone === 'neutral' && 'text-ink-2 hover:bg-paper-sunk hover:text-ink',
    tone === 'danger' && 'text-ink-2 hover:bg-pending-50 hover:text-pending-700'
  );

export const MemberList: React.FC<MemberListProps> = ({
  members,
  loading,
  onEdit,
  onDelete,
  onViewPass,
  canManage,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}) => {
  if (loading) return null;

  if (members.length === 0) {
    return (
      <EmptyState
        icon={User}
        title="Belum ada anggota yang terdaftar"
        description="Silakan tambah anggota secara manual atau gunakan fitur Import CSV/JSON."
      />
    );
  }

  const items: RowListItem[] = members.map((member) => {
    const contact = [member.email, member.phone].filter(Boolean).join(' · ');
    const meta = [member.external_id, member.division || member.group_name, contact]
      .filter(Boolean)
      .join('  ·  ');

    return {
      id: member.id,
      title: member.name,
      meta: meta || undefined,
      status: {
        label: member.status === 'active' ? 'Aktif' : 'Nonaktif',
        tone: member.status === 'active' ? ('seal' as const) : ('idle' as const),
      },
      action: (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onViewPass(member)}
            title="Lihat & Unduh QR Universal"
            aria-label={`Lihat Pass QR ${member.name}`}
            className={iconButtonClass('pen')}
          >
            <Eye className="w-4 h-4" />
          </button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(member)}
                title="Edit Anggota"
                aria-label={`Edit ${member.name}`}
                className={iconButtonClass('neutral')}
              >
                <PencilSimple className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(member.id, member.name)}
                title="Hapus Anggota"
                aria-label={`Hapus ${member.name}`}
                className={iconButtonClass('danger')}
              >
                <Trash className="w-4 h-4" />
              </button>
            </>
          )}
        </span>
      ),
    };
  });

  return (
    <RowList
      items={items}
      selectable={Boolean(onToggleSelect)}
      selectedIds={selectedIds}
      onToggle={onToggleSelect}
      onToggleAll={onToggleSelectAll}
      itemLabel="anggota"
    />
  );
};