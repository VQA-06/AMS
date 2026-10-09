import React, { useState } from 'react';
import { Buildings } from '@phosphor-icons/react/Buildings';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { UserCheck } from '@phosphor-icons/react/UserCheck';
import { Warning } from '@phosphor-icons/react/Warning';
import { X } from '@phosphor-icons/react/X';
import { Member, ApiResponse, CandidateInductionResult } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';
import { invalidateCache } from '../../lib/swr-client';
import { cn } from '../../lib/cn';
import { ModalPortal } from '../ui/ModalPortal';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Badge } from '../ui/Badge';

/** One focus quartet. Never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export interface CandidateInductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCandidates: Member[];
  allCandidatesCount?: number;
  divisionList?: string[];
  batchGroup?: string;
  onSuccess: () => void;
}

export const CandidateInductionModal: React.FC<CandidateInductionModalProps> = ({
  isOpen,
  onClose,
  selectedCandidates,
  allCandidatesCount,
  divisionList = [],
  batchGroup,
  onSuccess,
}) => {
  const [division, setDivision] = useState<string>('');
  const [archiveRemaining, setArchiveRemaining] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalPool = allCandidatesCount ?? selectedCandidates.length;
  const remainingCount = Math.max(0, totalPool - selectedCandidates.length);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCandidates.length === 0) {
      setError('Pilih minimal satu calon anggota untuk dilantik.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await fetchApi<ApiResponse<CandidateInductionResult>>('/api/members/candidates/induct', {
        method: 'POST',
        body: JSON.stringify({
          member_ids: selectedCandidates.map((c) => c.id),
          archive_remaining: archiveRemaining,
          batch_group: batchGroup || undefined,
          division: division.trim() !== '' ? division.trim() : undefined,
        }),
      });

      invalidateCache('/api/members');
      invalidateCache('/api/attendances');
      window.dispatchEvent(new CustomEvent('ams:data-mutated'));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal melantik calon anggota';
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
                <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-pen-deep" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-base font-bold text-ink sm:text-lg">
                  Pelantikan Calon Anggota
                </h2>
                <p className="truncate text-[11px] text-ink-2 sm:text-xs">
                  Lantik calon anggota terpilih menjadi anggota aktif resmi
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
          <div className="flex-1 space-y-4 overflow-y-auto py-3.5 pr-1 sm:py-4">
            {/* Candidate Preview List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink">
                  Daftar Calon yang Dilantik
                </label>
                <Badge variant="pending" size="xs">
                  {selectedCandidates.length} Calon Terpilih
                </Badge>
              </div>

              <div className="max-h-36 space-y-1 overflow-y-auto rounded-panel border border-rule bg-paper-sunk p-2">
                {selectedCandidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-chip bg-paper-raised px-2.5 py-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{c.name}</p>
                      <p className="truncate text-[11px] text-ink-2">
                        {[c.external_id, c.division || c.group_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Sparkle className="h-3.5 w-3.5 shrink-0 text-pen-deep" />
                  </div>
                ))}
              </div>
            </div>

            {/* Division Assignment Selector */}
            <Field
              id="candidate-induction-modal-division"
              label="Tetapkan Divisi Resmi (Opsional)"
              control="select"
              value={division}
              onChange={setDivision}
              leadingIcon={<Buildings className="h-4 w-4 text-ink-2" />}
              options={[
                { value: '', label: 'Pertahankan Divisi Calon Saat Ini' },
                ...divisionList.map((div) => ({ value: div, label: div })),
              ]}
              hint="Pilih divisi penempatan untuk seluruh calon terpilih atau pertahankan divisi sebelumnya."
            />

            {/* Cohort Sweeping Option */}
            <div className="rounded-panel border border-rule bg-paper-raised p-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="candidate-induction-modal-sweep"
                  checked={archiveRemaining}
                  onChange={(e) => setArchiveRemaining(e.target.checked)}
                  className={cn(
                    'mt-0.5 h-4 w-4 rounded border-rule-strong text-pen-600',
                    focusRing
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink">
                    Arsipkan calon anggota yang tidak terpilih
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-2 leading-relaxed">
                    Otomatis memindahkan calon anggota lain dalam angkatan ini yang tidak dilantik ke tab Arsip.
                  </p>
                </div>
              </label>
            </div>

            {/* Impact Preview Callout */}
            <div className="rounded-panel border border-rule bg-paper-raised p-3 text-xs text-ink-2 space-y-1.5">
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-seal-600 shrink-0" />
                Ringkasan Dampak Pelantikan:
              </p>
              <ul className="space-y-1 pl-5 list-disc text-[11px]">
                <li>
                  <span className="font-semibold text-ink">{selectedCandidates.length} calon</span> akan
                  berubah status menjadi <span className="font-semibold text-seal-700">Anggota Aktif Resmi</span> dan muncul di daftar Anggota Resmi.
                </li>
                {archiveRemaining && remainingCount > 0 && (
                  <li className="text-pending-800">
                    <span className="font-semibold">{remainingCount} calon lainnya</span> dalam angkatan
                    ini akan dipindahkan ke <span className="font-semibold">Arsip Calon</span>.
                  </li>
                )}
                {!archiveRemaining && remainingCount > 0 && (
                  <li>
                    <span className="font-semibold text-ink">{remainingCount} calon lainnya</span> tetap
                    berstatus Calon Aktif untuk proses selanjutnya.
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-rule pt-3 sm:gap-3 sm:pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading || selectedCandidates.length === 0}
              icon={<UserCheck className="w-4 h-4" />}
            >
              {loading ? 'Memproses Pelantikan...' : 'Lantik & Tetapkan Anggota'}
            </Button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
};
