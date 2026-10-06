import React, { useState, useEffect } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { FloppyDisk } from '@phosphor-icons/react/FloppyDisk';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { X } from '@phosphor-icons/react/X';
import { Member } from '@/shared/types';
import { MemberInput } from '@/shared/schemas/member.schema';
import { cn } from '../../lib/cn';
import { ModalPortal } from '../ui/ModalPortal';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

/** One focus quartet. Never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
];

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MemberInput) => Promise<void>;
  member?: Member | null;
  divisionList?: string[];
  groupList?: string[];
}

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  member,
  divisionList = [],
  groupList = [],
}) => {
  const [formData, setFormData] = useState<MemberInput>({
    external_id: '',
    name: '',
    division: '',
    group_name: '',
    email: '',
    phone: '',
    status: 'active',
    metadata: {},
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateAutoId = () => {
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    return `MBR-${randomHex}`;
  };

  useEffect(() => {
    if (member) {
      setFormData({
        external_id: member.external_id,
        name: member.name,
        division: member.division || '',
        group_name: member.group_name || '',
        email: member.email || '',
        phone: member.phone || '',
        status: member.status,
        metadata:
          typeof member.metadata === 'string'
            ? (() => {
                try {
                  return JSON.parse(member.metadata as string);
                } catch {
                  return {};
                }
              })()
            : (member.metadata || {}),
      });
    } else {
      setFormData({
        external_id: generateAutoId(),
        name: '',
        division: '',
        group_name: '',
        email: '',
        phone: '',
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
      external_id: generateAutoId(),
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
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop-full">
        <form
          onSubmit={handleSubmit}
          className="surface bezel-core my-auto flex max-h-[86dvh] w-full max-w-lg flex-col overflow-hidden p-3.5 sm:max-h-[85vh] sm:p-6"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-rule pb-2.5 sm:pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-pen-50/70 text-ink-2 sm:h-9 sm:w-9">
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-base font-bold text-ink sm:text-lg">
                  {member ? 'Edit Data Anggota' : 'Tambah Anggota Baru'}
                </h2>
                <p className="truncate text-[11px] text-ink-2 sm:text-xs">
                  ID dibuat otomatis, divisi & grup opsional
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className={cn(
                'shrink-0 rounded-full bg-paper-raised p-1.5 text-ink-2 transition-colors hover:bg-paper hover:text-ink sm:p-2',
                focusRing
              )}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-2.5 shrink-0 rounded-panel border border-pen-200 bg-pen-50/70 p-2.5 text-xs text-pen-deep sm:mt-3 sm:p-3"
            >
              {error}
            </div>
          )}

          {/* Form Body */}
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto overscroll-contain py-3 pr-1 touch-auto sm:space-y-4 sm:py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field
                id="member-form-modal-field-1"
                label="ID / Kode Anggota"
                control="text"
                required
                value={formData.external_id || ''}
                onChange={(v) => setFormData({ ...formData, external_id: v })}
                placeholder="misal: MBR-102938"
                controlClassName="pr-16 font-oxanium"
                trailing={
                  !member ? (
                    <button
                      type="button"
                      onClick={handleRefreshId}
                      aria-label="Generate ID baru"
                      className={cn(
                        'flex items-center gap-1 rounded-chip px-1.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink',
                        focusRing
                      )}
                      title="Generate ID baru"
                    >
                      <ArrowClockwise className="w-3 h-3" />
                      <span>Auto ID</span>
                    </button>
                  ) : undefined
                }
              />

              <Field
                id="member-form-modal-field-2"
                label="Nama Lengkap"
                control="text"
                required
                value={formData.name}
                onChange={(v) => setFormData({ ...formData, name: v })}
                placeholder="misal: Budi Santoso"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="member-form-modal-field-3"
                label="Divisi (Opsional)"
                control="text"
                value={formData.division || ''}
                onChange={(v) => setFormData({ ...formData, division: v })}
                placeholder="misal: Acara, Logistik, Humas"
                suggestions={divisionList}
              />

              <Field
                id="member-form-modal-field-4"
                label="Grup (Opsional)"
                control="text"
                value={formData.group_name || ''}
                onChange={(v) => setFormData({ ...formData, group_name: v })}
                placeholder="misal: Panitia Inti, Peserta"
                suggestions={groupList}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="member-form-modal-field-5"
                label="Email"
                control="email"
                autoComplete="email"
                value={formData.email || ''}
                onChange={(v) => setFormData({ ...formData, email: v })}
                placeholder="email@example.com"
              />

              <Field
                id="member-form-modal-field-6"
                label="No. Telepon / WA"
                control="tel"
                value={formData.phone || ''}
                onChange={(v) => setFormData({ ...formData, phone: v })}
                placeholder="08123456789"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field
                id="member-form-modal-field-7"
                label="Status"
                control="select"
                value={formData.status}
                onChange={(v) =>
                  setFormData({ ...formData, status: v as 'active' | 'inactive' })
                }
                options={STATUS_OPTIONS}
                controlClassName="cursor-pointer"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-rule pt-3 sm:gap-3 sm:pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading}
              icon={<FloppyDisk className="w-4 h-4" />}
            >
              {loading ? 'Menyimpan...' : 'Simpan Data'}
            </Button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
};
