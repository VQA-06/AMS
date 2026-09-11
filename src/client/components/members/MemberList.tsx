import React from 'react';
import {
  User,
  Building2,
  Phone,
  Mail,
  Edit2,
  Eye,
  Trash2,
} from 'lucide-react';
import { Member } from '@/shared/types';
import { SkeletonMemberList } from '../ui/Skeleton';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

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
          const isSelected = selectedIds?.has(member.id);
          return (
            <div
              key={member.id}
              className={`content-auto glass-panel-elevated rounded-2xl p-4 border transition-all space-y-3 ${
                isSelected ? 'border-sky-500/80 bg-sky-950/20 shadow-lg shadow-sky-500/10' : 'border-slate-800/80 shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  {onToggleSelect && (
                    <input
                      type="checkbox"
                      checked={isSelected || false}
                      onChange={() => onToggleSelect(member.id)}
                      aria-label={`Pilih ${member.name}`}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500 shrink-0"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-white">{member.name}</h4>
                      <Badge
                        variant={member.status === 'active' ? 'emerald' : 'rose'}
                        size="xs"
                        dot
                      >
                        {member.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    <p className="text-xs text-sky-400 font-mono mt-0.5">ID: {member.external_id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onViewPass(member)}
                    title="Lihat & Unduh QR Universal"
                    aria-label={`Lihat Pass QR ${member.name}`}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center text-sky-400 hover:text-sky-300 hover:bg-sky-950/50 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
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
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(member.id, member.name)}
                        title="Hapus Anggota"
                        aria-label={`Hapus ${member.name}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Badges: Divisi & Group */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {member.division ? (
                  <Badge variant="sky" size="xs" icon={<Building2 className="w-3 h-3 text-sky-400 shrink-0" />}>
                    Divisi: {member.division}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">Tanpa Divisi</span>
                )}

                {member.group_name && (
                  <Badge variant="slate" size="xs">
                    {member.group_name}
                  </Badge>
                )}
              </div>

              {/* Email & Phone info */}
              {(member.email || member.phone) && (
                <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-400 space-y-1">
                  {member.email && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </p>
                  )}
                  {member.phone && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{member.phone}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (visible on md screens and up) */}
      <div className="hidden md:block glass-panel rounded-3xl overflow-hidden border border-slate-800/80 shadow-xl">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              {onToggleSelectAll && (
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                    title={isAllSelected ? 'Batalkan pilih semua' : 'Pilih semua'}
                    aria-label="Pilih semua anggota"
                  />
                </th>
              )}
              <th className="px-5 py-3.5">ID / Kode</th>
              <th className="px-5 py-3.5">Nama Anggota</th>
              <th className="px-5 py-3.5 whitespace-nowrap">Divisi</th>
              <th className="px-5 py-3.5">Grup</th>
              <th className="px-5 py-3.5">Kontak</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {members.map((member) => {
              const isSelected = selectedIds?.has(member.id);
              return (
                <tr
                  key={member.id}
                  className={`transition-colors ${
                    isSelected ? 'bg-sky-950/20 hover:bg-sky-950/30' : 'hover:bg-slate-900/40'
                  }`}
                >
                  {onToggleSelect && (
                    <td className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected || false}
                        onChange={() => onToggleSelect(member.id)}
                        aria-label={`Pilih ${member.name}`}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                      />
                    </td>
                  )}
                  <td className="px-5 py-3.5 font-mono text-xs text-sky-400 font-semibold">
                    {member.external_id}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">
                    {member.name}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    {member.division ? (
                      <Badge variant="sky" size="xs" icon={<Building2 className="w-3 h-3 text-sky-400 shrink-0" />}>
                        {member.division}
                      </Badge>
                    ) : (
                      <span className="text-slate-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-300">
                    {member.group_name || '-'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400 space-y-0.5">
                    {member.email && <div className="truncate max-w-[160px]">{member.email}</div>}
                    {member.phone && <div className="text-slate-500">{member.phone}</div>}
                    {!member.email && !member.phone && <span>-</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={member.status === 'active' ? 'emerald' : 'rose'}
                      size="xs"
                      dot
                    >
                      {member.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onViewPass(member)}
                        title="Lihat & Unduh QR Universal"
                        aria-label={`Lihat Pass QR ${member.name}`}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-sky-400 hover:text-sky-300 hover:bg-sky-950/60 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
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
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-sky-500 focus:outline-none"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(member.id, member.name)}
                            title="Hapus Anggota"
                            aria-label={`Hapus ${member.name}`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-none"
                          >
                            <Trash2 className="w-4 h-4" />
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
  );
};
