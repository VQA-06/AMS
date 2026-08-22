import React from 'react';
import {
  User,
  Building2,
  Phone,
  Mail,
  Edit2,
  UserX,
  QrCode,
  Eye,
  Trash2,
} from 'lucide-react';
import { Member } from '@/shared/types';
import { SkeletonMemberList } from '../ui/Skeleton';

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
  onDeactivate,
  onDelete,
  onGenerateQr,
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
      <div className="glass-panel rounded-3xl p-10 text-center border border-slate-800 animate-in fade-in duration-200">
        <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-bold text-slate-300">Belum ada anggota yang terdaftar</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Silakan tambah anggota secara manual atau gunakan fitur Import CSV/JSON.
        </p>
      </div>
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
              className={`glass-panel-elevated rounded-2xl p-4 border transition-all space-y-3 ${
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
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500 shrink-0"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-white">{member.name}</h4>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          member.status === 'active'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                        }`}
                      >
                        {member.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="text-xs text-sky-400 font-mono mt-0.5">ID: {member.external_id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onViewPass(member)}
                    title="Lihat & Unduh QR Universal"
                    className="p-2 text-sky-400 hover:bg-sky-950/50 rounded-xl transition-colors font-semibold"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => onEdit(member)}
                        title="Edit Anggota"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(member.id, member.name)}
                        title="Hapus Anggota"
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-950/60 text-sky-300 border border-sky-800/40">
                    <Building2 className="w-3 h-3 text-sky-400" />
                    <span>Divisi: {member.division}</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">Tanpa Divisi</span>
                )}

                {member.group_name && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300">
                    {member.group_name}
                  </span>
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
                  />
                </th>
              )}
              <th className="px-5 py-3.5">ID / Kode</th>
              <th className="px-5 py-3.5">Nama Anggota</th>
              <th className="px-5 py-3.5">Divisi</th>
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
                  <td className="px-5 py-3.5">
                    {member.division ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-sky-950/60 text-sky-300 border border-sky-800/40">
                        <Building2 className="w-3 h-3 text-sky-400 shrink-0" />
                        <span>{member.division}</span>
                      </span>
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
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      member.status === 'active'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                    }`}
                  >
                    {member.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onViewPass(member)}
                      title="Lihat & Unduh QR Universal"
                      className="p-1.5 text-sky-400 hover:bg-sky-950/60 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canManage && (
                      <>
                        <button
                          onClick={() => onEdit(member)}
                          title="Edit Anggota"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(member.id, member.name)}
                          title="Hapus Anggota"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
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
