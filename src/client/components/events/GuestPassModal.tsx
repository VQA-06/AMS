import { cn } from '../../lib/cn';
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';
import { ListNumbers } from '@phosphor-icons/react/ListNumbers';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Users } from '@phosphor-icons/react/Users';
import { X } from '@phosphor-icons/react/X';
import { Event } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';
import { ModalPortal } from '../ui/ModalPortal';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

interface GuestPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  onSuccess: (options?: { shouldPrint?: boolean }) => void;
}

interface GuestSourceEvent {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at?: string | null;
  guest_count: number;
}

interface GuestCandidate {
  member_id: string;
  name: string;
  external_id: string;
  division: string | null;
  token_jti: string;
  token_id: string;
  already_imported: boolean;
}

export const GuestPassModal: React.FC<GuestPassModalProps> = ({
  isOpen,
  onClose,
  event,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'names' | 'batch' | 'import_events'>('names');
  const [nameListText, setNameListText] = useState<string>('');
  const [batchPrefix, setBatchPrefix] = useState<string>('Tamu Undangan');
  const [batchCount, setBatchCount] = useState<number>(10);
  const [defaultDivision, setDefaultDivision] = useState<string>('Tamu Undangan');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Import from previous events state
  const [sources, setSources] = useState<GuestSourceEvent[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GuestCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch sources when opening or switching to import_events mode
  useEffect(() => {
    if (isOpen && mode === 'import_events') {
      let isMounted = true;
      setLoadingSources(true);
      setError(null);
      fetchApi<{ sources: GuestSourceEvent[] }>(`/api/agenda/${event.id}/guest-sources`)
        .then((res) => {
          if (!isMounted) return;
          const list = res.sources || [];
          setSources(list);
          if (list.length > 0) {
            setSelectedSourceId(list[0].id);
            // Prefetch candidates for the first source event immediately to eliminate waterfall
            setLoadingCandidates(true);
            fetchApi<{ candidates: GuestCandidate[] }>(
              `/api/agenda/${event.id}/guest-candidates?source_id=${list[0].id}`
            )
              .then((candRes) => {
                if (!isMounted) return;
                setCandidates(candRes.candidates || []);
              })
              .catch(() => {
                // Caught silently; next effect or user selection can retry
              })
              .finally(() => {
                if (isMounted) setLoadingCandidates(false);
              });
          } else {
            setSelectedSourceId(null);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err instanceof Error ? err.message : 'Gagal memuat daftar kegiatan sebelumnya.');
        })
        .finally(() => {
          if (isMounted) setLoadingSources(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, mode, event.id]);

  // Fetch candidate guests when selected source event changes
  useEffect(() => {
    if (isOpen && mode === 'import_events' && selectedSourceId) {
      let isMounted = true;
      setLoadingCandidates(true);
      setSelectedMemberIds(new Set());
      fetchApi<{ candidates: GuestCandidate[] }>(
        `/api/agenda/${event.id}/guest-candidates?source_id=${selectedSourceId}`
      )
        .then((res) => {
          if (!isMounted) return;
          setCandidates(res.candidates || []);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err instanceof Error ? err.message : 'Gagal memuat data tamu dari kegiatan sumber.');
        })
        .finally(() => {
          if (isMounted) setLoadingCandidates(false);
        });

      return () => {
        isMounted = false;
      };
    } else if (!selectedSourceId) {
      setCandidates([]);
      setSelectedMemberIds(new Set());
    }
  }, [isOpen, mode, selectedSourceId, event.id]);

  // Candidates filtered by search
  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.external_id.toLowerCase().includes(q) ||
        (c.division && c.division.toLowerCase().includes(q))
    );
  }, [candidates, searchQuery]);

  const unimportedFiltered = useMemo(
    () => filteredCandidates.filter((c) => !c.already_imported),
    [filteredCandidates]
  );

  const isAllSelected =
    unimportedFiltered.length > 0 &&
    unimportedFiltered.every((c) => selectedMemberIds.has(c.member_id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        for (const c of unimportedFiltered) {
          next.delete(c.member_id);
        }
        return next;
      });
    } else {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        for (const c of unimportedFiltered) {
          next.add(c.member_id);
        }
        return next;
      });
    }
  };

  const handleToggleSelectMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'names') {
        const lines = nameListText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          throw new Error('Masukkan setidaknya 1 nama peserta tamu.');
        }

        const items = lines.map((line) => {
          const parts = line.split(',').map((p) => p.trim());
          return {
            name: parts[0],
            division: parts[1] || defaultDivision || 'Tamu Undangan',
          };
        });

        await fetchApi(`/api/agenda/${event.id}/guests/batch-names`, {
          method: 'POST',
          body: JSON.stringify({ items }),
        });
      } else if (mode === 'batch') {
        if (batchCount < 1 || batchCount > 100) {
          throw new Error('Jumlah batch harus antara 1 sampai 100.');
        }

        await fetchApi(`/api/agenda/${event.id}/guests/batch`, {
          method: 'POST',
          body: JSON.stringify({
            count: batchCount,
            prefix: batchPrefix || 'Tamu Undangan',
            division: defaultDivision || 'Tamu Undangan',
          }),
        });
      } else {
        // mode === 'import_events'
        if (selectedMemberIds.size === 0) {
          throw new Error('Pilih setidaknya satu peserta tamu untuk diimpor.');
        }

        await fetchApi(`/api/agenda/${event.id}/guests/import`, {
          method: 'POST',
          body: JSON.stringify({
            guest_member_ids: Array.from(selectedMemberIds),
            source_event_id: selectedSourceId || undefined,
          }),
        });
      }

      onSuccess({ shouldPrint: mode !== 'import_events' });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses data tamu.';
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
          className="surface my-auto flex max-h-[86dvh] w-full max-w-lg flex-col overflow-hidden rounded-bezel p-3.5 sm:max-h-[88vh] sm:p-6"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-rule pb-2.5 sm:pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-pen-50/70 text-ink-2 sm:h-9 sm:w-9">
                <UserPlus size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-heading text-base font-bold text-ink sm:text-lg">
                  {mode === 'import_events' ? 'Impor Tamu dari Kegiatan Lalu' : 'Buat Peserta Tamu / Sementara'}
                </h3>
                <p className="truncate text-[11px] text-ink-2 sm:text-xs">Khusus untuk event: {event.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="touch-target shrink-0 rounded-chip bg-paper-raised p-1.5 text-ink-2 transition-colors duration-120 hover:text-ink sm:p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div role="alert" className="mt-2.5 shrink-0 rounded-panel border border-pen-200 bg-pen-50/70 p-2.5 text-xs text-pen-deep sm:mt-3 sm:p-3">
              {error}
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="mt-2.5 flex shrink-0 rounded-chip border border-rule bg-paper p-1 sm:mt-3">
            <button
              type="button"
              onClick={() => setMode('names')}
              className={`py-2 px-2 rounded-chip text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'names'
                  ? 'bg-pen-500 text-paper'
                  : 'border border-rule-strong bg-paper-raised text-ink-2 hover:text-ink'
              }`}
            >
              <Users size={16} className="shrink-0" />
              <span className="truncate">Daftar Nama</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`py-2 px-2 rounded-chip text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'batch'
                  ? 'bg-pen-500 text-paper'
                  : 'border border-rule-strong bg-paper-raised text-ink-2 hover:text-ink'
              }`}
            >
              <ListNumbers size={16} className="shrink-0" />
              <span className="truncate">Nomor Tiket</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('import_events')}
              className={`py-2 px-2 rounded-chip text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'import_events'
                  ? 'bg-pen-500 text-paper'
                  : 'border border-rule-strong bg-paper-raised text-ink-2 hover:text-ink'
              }`}
            >
              <ClockCounterClockwise size={16} className="shrink-0" />
              <span className="truncate">Kegiatan Lalu</span>
            </button>
          </div>

          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto overscroll-contain py-3 pr-1 sm:space-y-4 sm:py-4">
            {mode === 'names' ? (
              <>
                <Field
                  id="components-events-guestpassmodal-field-1"
                  label="Ketik Daftar Nama (1 Baris = 1 Peserta):"
                  control="textarea"
                  rows={4}
                  required
                  value={nameListText}
                  onChange={setNameListText}
                  placeholder="Contoh:&#10;Dr. Hendra Wijaya, VIP&#10;Siti Aminah, Konsumsi&#10;Ahmad Fauzan"
                  hint="Format: Nama, Divisi (opsional)"
                />

                <Field
                  id="components-events-guestpassmodal-field-2"
                  label="Divisi / Kategori Default:"
                  control="text"
                  value={defaultDivision}
                  onChange={setDefaultDivision}
                  placeholder="misal: Tamu / Undangan"
                />
              </>
            ) : mode === 'batch' ? (
              <>
                <div className="space-y-3">
                  <Field
                    id="components-events-guestpassmodal-field-3"
                    label="Prefix / Nama Label Tiket:"
                    control="text"
                    required
                    value={batchPrefix}
                    onChange={setBatchPrefix}
                    placeholder="misal: Tamu VIP"
                  />

                  <div>
                    <label
                      htmlFor="components-events-guestpassmodal-field-4"
                      className="block text-xs font-semibold text-ink mb-1"
                    >
                      Jumlah Tiket Tamu:
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setBatchCount(Math.max(1, batchCount - 5))}
                        className={cn(
                          'px-3 py-1.5 sm:py-2 rounded-chip border border-rule-strong bg-paper-sunk text-ink font-bold hover:bg-rule/40 hover:border-rule-strong active:scale-95 text-xs',
                          focusRing
                        )}
                      >
                        -5
                      </button>
                      <input
                        id="components-events-guestpassmodal-field-4"
                        type="number"
                        min="1"
                        max="100"
                        value={batchCount}
                        onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 1)}
                        className={cn(
                          'w-24 rounded-chip border border-rule-strong bg-paper-raised text-center font-oxanium text-sm font-bold tabular-nums text-ink-2 transition-colors duration-120 px-3 py-1.5 sm:py-2',
                          focusRing
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setBatchCount(Math.min(100, batchCount + 5))}
                        className={cn(
                          'px-3 py-1.5 sm:py-2 rounded-chip border border-rule-strong bg-paper-sunk text-ink font-bold hover:bg-rule/40 hover:border-rule-strong active:scale-95 text-xs',
                          focusRing
                        )}
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  <Field
                    id="components-events-guestpassmodal-field-5"
                    label="Divisi / Kategori Default:"
                    control="text"
                    value={defaultDivision}
                    onChange={setDefaultDivision}
                    placeholder="misal: Tamu / Undangan"
                  />
                </div>
              </>
            ) : (
              /* mode === 'import_events' */
              <div className="space-y-3.5">
                {/* Source Events Selection (Strictly 2 Previous Events) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-ink">
                      Pilih Kegiatan Sumber (Maksimal 2 Sebelumnya):
                    </label>
                    <span className="text-[10px] text-ink-2 font-mono">
                      {sources.length} kegiatan ditemukan
                    </span>
                  </div>

                  {loadingSources ? (
                    <div className="py-6 text-center text-xs text-ink-2 flex flex-col items-center gap-2">
                      <ArrowClockwise size={16} className="animate-spin text-ink-2" />
                      <span>Memeriksa kegiatan sebelumnya...</span>
                    </div>
                  ) : sources.length === 0 ? (
                    <div className="rounded-panel border border-rule bg-paper-raised p-5 text-center">
                      <CalendarBlank className="w-7 h-7 text-ink-3 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-ink">
                        Tidak ada kegiatan sebelumnya yang memiliki data tiket tamu
                      </p>
                      <p className="text-[11px] text-ink-2 mt-1 max-w-xs mx-auto">
                        Gunakan tab "Daftar Nama" atau "Nomor Tiket" untuk membuat tiket tamu baru untuk kegiatan ini.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sources.map((src) => {
                        const isSelected = selectedSourceId === src.id;
                        const dateStr = src.starts_at
                          ? new Date(src.starts_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Tanggal tidak disetel';

                        return (
                          <button
                            key={src.id}
                            type="button"
                            onClick={() => setSelectedSourceId(src.id)}
                            className={cn(`flex flex-col justify-between gap-1.5 rounded-panel border p-3 text-left transition-colors ${
                              isSelected
                                ? 'border-pen-300 bg-pen-50/70 ring-1 ring-pen-500/30'
                                : 'border-rule-strong bg-paper-raised text-ink hover:border-rule-strong'
                            }`)}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <span
                                className={`font-semibold text-xs leading-snug line-clamp-1 ${
                                  isSelected ? 'text-ink' : 'text-ink'
                                }`}
                              >
                                {src.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                                  isSelected ? 'bg-pen-500 text-paper' : 'bg-paper-raised text-ink-2'
                                }`}
                              >
                                {src.guest_count} Tamu
                              </span>
                            </div>
                            <span className="flex items-center gap-1 font-oxanium text-[10px] text-ink-2">
                              <CalendarBlank size={12} className="text-ink-2" />
                              <span>{dateStr}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Candidate Guests List */}
                {selectedSourceId && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <MagnifyingGlass className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nama / ID / divisi tamu..."
                          className="w-full rounded-chip border border-rule-strong bg-paper-raised py-1.5 pl-8 pr-3 text-xs text-ink transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper placeholder:text-ink-2"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        disabled={unimportedFiltered.length === 0}
                        className={cn(
                          'px-2.5 py-1.5 rounded-chip border border-rule-strong bg-paper-sunk hover:bg-rule/40 hover:border-rule-strong text-ink text-[11px] font-semibold whitespace-nowrap disabled:opacity-40 transition-colors',
                          focusRing
                        )}
                      >
                        {isAllSelected ? 'Batal Semua' : 'Pilih Semua'}
                      </button>
                    </div>

                    {/* QR Reusability Notice */}
                    <div className="px-3 py-2 rounded-chip bg-seal-50/70 border border-seal-200 text-[11px] text-seal-800 flex items-center justify-between">
                      <span className="leading-tight">QR tamu tetap sama & langsung aktif untuk kegiatan ini.</span>
                      <span className="font-bold text-seal-600 font-mono text-xs shrink-0 ml-2">
                        {selectedMemberIds.size} dipilih
                      </span>
                    </div>

                    {/* Scrollable List of Candidates */}
                    <div className="max-h-52 overflow-y-auto overscroll-contain divide-y divide-rule-strong/60 rounded-panel border border-rule-strong bg-paper-sunk/40 p-1">
                      {loadingCandidates ? (
                        <div className="py-8 text-center text-xs text-ink-2 flex flex-col items-center gap-2">
                          <ArrowClockwise size={16} className="animate-spin text-ink-2" />
                          <span>Memuat daftar tamu dari kegiatan sumber...</span>
                        </div>
                      ) : filteredCandidates.length === 0 ? (
                        <div className="py-8 text-center text-xs text-ink-2">
                          {searchQuery
                            ? 'Tidak ada peserta tamu yang cocok dengan pencarian.'
                            : 'Tidak ada data peserta tamu di kegiatan ini.'}
                        </div>
                      ) : (
                        filteredCandidates.map((cand) => {
                          const isSelected = selectedMemberIds.has(cand.member_id);
                          return (
                            <label
                              key={cand.member_id}
                              htmlFor={`guest-cand-${cand.member_id}`}
                              className={`flex items-center justify-between p-2.5 sm:p-3 min-h-[44px] rounded-chip transition-colors ${
                                cand.already_imported
                                  ? 'opacity-40 cursor-not-allowed bg-paper-sunk/20'
                                  : isSelected
                                  ? 'cursor-pointer bg-pen-50/70 hover:bg-pen-50/70'
                                  : 'hover:bg-rule/40 cursor-pointer'
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <input
                                  id={`guest-cand-${cand.member_id}`}
                                  type="checkbox"
                                  checked={isSelected || cand.already_imported}
                                  disabled={cand.already_imported}
                                  onChange={() => {
                                    if (!cand.already_imported) {
                                      handleToggleSelectMember(cand.member_id);
                                    }
                                  }}
                                  aria-label={`Pilih peserta tamu ${cand.name}`}
                                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-rule-strong bg-paper-raised accent-pen-500"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-ink truncate">
                                      {cand.name}
                                    </span>
                                    {cand.division && (
                                      <span className="truncate rounded bg-rule-strong px-1.5 py-0.5 text-[10px] font-medium text-ink">
                                        {cand.division}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-ink-2 font-mono">
                                    {cand.external_id}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 ml-2">
                                {cand.already_imported ? (
                                  <span className="rounded-chip bg-paper-raised px-2 py-0.5 text-[10px] font-semibold text-ink-2">
                                    Sudah Ada
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-seal-50 text-seal-800 border border-seal-200">
                                    Siap Impor
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-rule pt-3 sm:gap-3 sm:pt-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Batal
            </Button>
            <button
              type="submit"
              disabled={
                loading ||
                (mode === 'import_events' && (selectedMemberIds.size === 0 || sources.length === 0))
              }
              className="flex items-center gap-2 rounded-chip bg-pen-500 px-4 py-2 text-xs font-bold text-paper transition-transform duration-120 active:scale-95 hover:bg-pen-400 disabled:pointer-events-none disabled:opacity-50 sm:px-5 sm:py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <Sparkle size={16} className="shrink-0" />
              <span>
                {loading
                  ? mode === 'import_events'
                    ? 'Mengimpor Tamu...'
                    : 'Membuat Tiket...'
                  : mode === 'import_events'
                  ? selectedMemberIds.size > 0
                    ? `Impor ${selectedMemberIds.size} Tamu (Gunakan QR Lama)`
                    : 'Pilih Tamu untuk Diimpor'
                  : 'Buat Tiket QR Tamu'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
};
