import React, { useState } from 'react';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { X } from '@phosphor-icons/react/X';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { Users } from '@phosphor-icons/react/Users';
import { fetchApi } from '../../lib/api-client';
import { invalidateCache } from '../../lib/swr-client';
import { cn } from '../../lib/cn';
import { ModalPortal } from '../ui/ModalPortal';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Badge } from '../ui/Badge';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export interface ConvertGuestItem {
  id: string;
  name: string;
  external_id?: string;
  division?: string | null;
  group_name?: string | null;
}

export interface ConvertGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGuests: ConvertGuestItem[];
  divisionList?: string[];
  onSuccess: () => void;
}

export const ConvertGuestModal: React.FC<ConvertGuestModalProps> = ({
  isOpen,
  onClose,
  selectedGuests,
  divisionList = [],
  onSuccess,
}) => {
  const [targetGroup, setTargetGroup] = useState<string>('Calon Anggota');
  const [division, setDivision] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGuests.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        guest_member_ids: selectedGuests.map((g) => g.id),
        target_group: targetGroup.trim() || undefined,
        target_division: division.trim() || undefined,
      };

      await fetchApi('/api/members/candidates/convert-from-guests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      invalidateCache('/api/members');
      invalidateCache('/api/events');
      invalidateCache('/api/attendances');
      window.dispatchEvent(new CustomEvent('ams:data-mutated'));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memproses migrasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop-full">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="convert-guest-title"
          className="surface bezel my-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto p-4 text-ink sm:p-6"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-rule pb-3 sm:pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel bg-pen-50 text-pen-deep sm:h-10 sm:w-10">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="convert-guest-title"
                  className="truncate font-heading text-base font-bold text-ink sm:text-lg"
                >
                  Migrasi ke Calon Anggota
                </h2>
                <p className="truncate text-[11px] text-ink-2 sm:text-xs">
                  Ubah peserta tamu kegiatan menjadi Calon Anggota resmi
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
              <X className="h-4 w-4 sm:h-5 sm:h-5" />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 shrink-0 rounded-panel border border-pen-200 bg-pen-50/70 p-2.5 text-xs text-pen-deep sm:p-3"
            >
              {error}
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Informational Callouts */}
            <div className="space-y-2 rounded-panel border border-rule bg-paper-sunk/60 p-3 text-xs">
              <div className="flex items-start gap-2 text-ink">
                <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-pen-deep" />
                <p className="text-[11.5px] leading-relaxed text-ink-2">
                  <strong className="font-semibold text-ink">QR Code Tetap Aktif:</strong> QR Code digital/fisik yang telah dimiliki peserta tetap valid tanpa perlu dicetak ulang. Batas scan dilepas dan berlaku permanen.
                </p>
              </div>
              <div className="flex items-start gap-2 text-ink">
                <ChartLineUp className="mt-0.5 h-4 w-4 shrink-0 text-seal-600" />
                <p className="text-[11.5px] leading-relaxed text-ink-2">
                  <strong className="font-semibold text-ink">Riwayat Kehadiran Tersambung:</strong> Semua riwayat absensi selama menjadi tamu langsung dihitung ke dalam analitik keaktifan calon anggota.
                </p>
              </div>
            </div>

            {/* Selected Guests Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink">
                  Daftar Tamu yang Dimigrasikan
                </label>
                <Badge variant="neutral" size="xs">
                  {selectedGuests.length} Orang
                </Badge>
              </div>
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-panel border border-rule bg-paper-sunk/40 p-2">
                {selectedGuests.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-chip bg-paper px-2.5 py-1.5 text-xs text-ink shadow-sm"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-medium text-ink">{g.name}</p>
                      <p className="truncate text-[10px] text-ink-3">
                        {g.external_id || 'Tamu'} {g.division ? `• ${g.division}` : ''}
                      </p>
                    </div>
                    <Badge variant="pending" size="xs">
                      Tamu
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Group / Cohort */}
            <Field
              id="convert-guest-field-1"
              label="Kelompok / Angkatan Calon Anggota"
              control="text"
              value={targetGroup}
              onChange={setTargetGroup}
              placeholder="Contoh: Calon Anggota 2026"
              leadingIcon={<Users className="h-4 w-4" />}
              required
            />

            {/* Division Selection */}
            {divisionList.length > 0 ? (
              <Field
                id="convert-guest-field-2"
                label="Divisi Target (Opsional)"
                control="select"
                value={division}
                onChange={setDivision}
                leadingIcon={<Buildings className="h-4 w-4" />}
                options={[
                  { value: '', label: '-- Tetapkan divisi saat ini / Belum ada --' },
                  ...divisionList.map((d) => ({ value: d, label: d })),
                ]}
              />
            ) : (
              <Field
                id="convert-guest-field-2"
                label="Divisi Target (Opsional)"
                control="text"
                value={division}
                onChange={setDivision}
                placeholder="Contoh: Acara / Logistik"
                leadingIcon={<Buildings className="h-4 w-4" />}
              />
            )}

            {/* Footer Actions */}
            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-rule pt-3 sm:pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={loading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={loading}
                disabled={selectedGuests.length === 0}
              >
                Jadikan Calon Anggota ({selectedGuests.length})
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
