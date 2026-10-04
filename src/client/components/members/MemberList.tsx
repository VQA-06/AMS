import React from 'react';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { Envelope } from '@phosphor-icons/react/Envelope';
import { Eye } from '@phosphor-icons/react/Eye';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Phone } from '@phosphor-icons/react/Phone';
import { Trash } from '@phosphor-icons/react/Trash';
import { User } from '@phosphor-icons/react/User';
import { Member } from '@/shared/types';
import { cn } from '../../lib/cn';
import { SkeletonMemberList } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Card, markFillClass } from '../ui/Card';
import { Table, THead, TBody, TRow, TCell } from '../ui/Table';

interface MemberListProps {
  members: Member[];
  loading?: boolean;
  onEdit: (member: Member) => void;
  onDeactivate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onGenerateQr: (member: Member) => void;
  onViewPass: (member: Member) => void;
  canManage?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
}

/** One focus quartet. Never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const checkboxClass =
  'w-4 h-4 shrink-0 cursor-pointer rounded border-rule-strong bg-paper-raised accent-pen-500';

const iconButtonClass = (tone: 'pen' | 'neutral' | 'danger') =>
  cn(
    'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-chip transition-colors duration-120 ease-out-expo',
    focusRing,
    tone === 'pen' && 'text-ink-2 hover:bg-pen-50/70 hover:text-ink-2',
    tone === 'neutral' && 'text-ink-2 hover:bg-paper-raised hover:text-white',
    tone === 'danger' && 'text-pen hover:bg-pen-50/70 hover:text-pen-deep'
  );

export const MemberList: React.FC<MemberListProps> = ({
  members,
  loading = false,
  onEdit,
  onDeactivate: _onDeactivate,
  onDelete,
  onGenerateQr: _onGenerateQr,
  onViewPass,
  canManage = true,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected = false,
}) => {
  // Show smooth skeleton shimmer placeholders while data is fetching
  if (loading) {
    return <SkeletonMemberList rows={8} />;
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={User}
        title="Belum ada anggota yang terdaftar"
        description="Silakan tambah anggota secara manual atau gunakan fitur Import CSV/JSON."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile Card View (visible on < md screens) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {members.map((member) => {
          const isSelected = selectedIds?.has(member.id) ?? false;
          return (
            <Card
              key={member.id}
              mark={isSelected ? 'pen' : member.status === 'active' ? 'seal' : 'idle'}
              className={cn(
                'transition-colors duration-120 ease-out-expo',
                isSelected && 'bg-paper-sunk'
              )}
            >
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {onToggleSelect && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(member.id)}
                        aria-label={`Pilih ${member.name}`}
                        className={checkboxClass}
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-heading text-base font-bold text-white">
                        {member.name}
                      </h3>
                      <p className="mt-0.5 font-oxanium text-xs text-ink-2">
                        ID: {member.external_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
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
                  </div>
                </div>

                {/* Division, email & phone */}
                <div className="space-y-1 border-t border-rule pt-2 text-xs text-ink-2">
                  {member.division && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Buildings className="w-3.5 h-3.5 shrink-0 text-ink-2" />
                      <span className="truncate">{member.division}</span>
                    </p>
                  )}
                  {member.email && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Envelope className="w-3.5 h-3.5 shrink-0 text-ink-2" />
                      <span className="truncate">{member.email}</span>
                    </p>
                  )}
                  {member.phone && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-ink-2" />
                      <span className="truncate">{member.phone}</span>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table View (visible on md screens and up) */}
      <div className="surface hidden rounded-panel shadow-ambient md:block">
        <Table>
          <THead>
            <tr>
              {onToggleSelectAll && (
                <TCell header className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onToggleSelectAll}
                    className={checkboxClass}
                    title={isAllSelected ? 'Batalkan pilih semua' : 'Pilih semua'}
                    aria-label="Pilih semua anggota"
                  />
                </TCell>
              )}
              <TCell header className="w-3 p-0">
                <span className="sr-only">Status</span>
              </TCell>
              <TCell header className="min-w-[12rem]">
                Nama Lengkap
              </TCell>
              <TCell header className="min-w-[8rem]">
                ID Anggota
              </TCell>
              <TCell header className="hidden min-w-[9rem] lg:table-cell">
                Divisi / Grup
              </TCell>
              <TCell header className="hidden min-w-[11rem] lg:table-cell">
                Kontak
              </TCell>
              <TCell header className="w-[10rem] text-right">
                Aksi
              </TCell>
            </tr>
          </THead>
          <TBody>
            {members.map((member) => {
              const isSelected = selectedIds?.has(member.id) ?? false;
              return (
                <TRow key={member.id} selected={isSelected}>
                  {onToggleSelectAll && (
                    <TCell className="text-center">
                      {onToggleSelect && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(member.id)}
                          aria-label={`Pilih ${member.name}`}
                          className={checkboxClass}
                        />
                      )}
                    </TCell>
                  )}
                  <TCell className="w-3 p-0">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-full w-0.5 self-stretch',
                        isSelected
                          ? markFillClass.pen
                          : member.status === 'active'
                            ? markFillClass.seal
                            : markFillClass.idle
                      )}
                    />
                  </TCell>
                  <TCell truncate>
                    <span className="block font-semibold text-ink">{member.name}</span>
                  </TCell>
                  <TCell truncate className="font-oxanium text-xs text-ink-2">
                    {member.external_id}
                  </TCell>
                  <TCell truncate className="hidden lg:table-cell">
                    {member.division || member.group_name ? (
                      member.division || member.group_name
                    ) : (
                      <span className="text-ink-3">&mdash;</span>
                    )}
                  </TCell>
                  <TCell truncate className="hidden lg:table-cell text-ink-2">
                    {[member.email, member.phone].filter(Boolean).join(' · ') || (
                      <span className="text-ink-3">&mdash;</span>
                    )}
                  </TCell>
                  <TCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
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
                    </div>
                  </TCell>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
};