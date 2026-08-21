import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, Sparkles, RefreshCw } from 'lucide-react';
import { Member } from '@/shared/types';
import { MemberInput } from '@/shared/schemas/member.schema';

interface MemberFormModalProps {
  member?: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MemberInput) => Promise<void>;
  divisionList?: string[];
  groupList?: string[];
}

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  member,
  isOpen,
  onClose,
  onSave,
  divisionList = [],
  groupList = [],
}) => {
  const generateRandomId = () => `MBR-${Math.floor(100000 + Math.random() * 900000)}`;

  const [formData, setFormData] = useState<MemberInput>({
    external_id: '',
    name: '',
    email: '',
    phone: '',
    group_name: '',
    division: '',
    status: 'active',
    metadata: {},
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      let parsedMetadata: Record<string, unknown> = {};
      if (typeof member.metadata === 'string') {
        try {
          parsedMetadata = JSON.parse(member.metadata);
        } catch {
          parsedMetadata = {};
        }
      } else if (member.metadata && typeof member.metadata === 'object') {
        parsedMetadata = member.metadata;
      }

      setFormData({
        external_id: member.external_id,
        name: member.name,
        email: member.email || '',
        phone: member.phone || '',
        group_name: member.group_name || '',
        division: member.division || '',
        status: member.status,
        metadata: parsedMetadata,
      });
    } else {
      setFormData({
        external_id: generateRandomId(),
        name: '',
        email: '',
        phone: '',
        group_name: '',
        division: '',
        status: 'active',
        metadata: {},
      });
    }
    setError(null);
  }, [member, isOpen]);

  if (!isOpen) return null;

  const handleRefreshId = () => {
    setFormData((prev) => ({
      ...prev,
      external_id: generateRandomId(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSave(formData);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan data anggota';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                {member ? 'Edit Data Anggota' : 'Tambah Anggota Baru'}
              </h3>
              <p className="text-xs text-slate-400">ID dibuat otomatis, divisi & grup opsional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  ID / Kode Anggota <span className="text-rose-400">*</span>
                </label>
                {!member && (
                  <button
                    type="button"
                    onClick={handleRefreshId}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                    title="Generate ID baru"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto ID</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={formData.external_id || ''}
                onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                placeholder="misal: MBR-102938"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Lengkap <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="misal: Budi Santoso"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Divisi <span className="text-slate-500 font-normal">(Opsional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="division-options"
                  value={formData.division || ''}
                  onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                  placeholder="misal: Acara, Logistik, Humas"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                />
                <datalist id="division-options">
                  {divisionList.map((div, i) => (
                    <option key={i} value={div} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Grup / Kategori <span className="text-slate-500 font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                list="group-options"
                value={formData.group_name || ''}
                onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                placeholder="misal: Panitia Inti, Peserta"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
              <datalist id="group-options">
                {groupList.map((grp, i) => (
                  <option key={i} value={grp} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">No. Telepon / WA</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="08123456789"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Menyimpan...' : 'Simpan Data'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
