import React, { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, Sparkles, Users, ListOrdered, History, Search, Calendar, RefreshCw } from 'lucide-react';
import { Event } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';
import { ModalPortal } from '../ui/ModalPortal';

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
    <ModalPortal>
      <div className="modal-backdrop-full animate-in fade-in">
        <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-4 sm:p-6 overflow-hidden max-h-[92dvh] sm:max-h-[88vh] flex flex-col my-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-bold text-base sm:text-lg text-white truncate">
                  {mode === 'import_events' ? 'Impor Tamu dari Kegiatan Lalu' : 'Buat Peserta Tamu / Sementara'}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">Khusus untuk event: {event.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 shrink-0 transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-xs text-rose-300 shrink-0">
              {error}
            </div>
          )}

          {/* Mode Switcher - 3 Tabs */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3 sm:mt-4 shrink-0">
            <button
              type="button"
              onClick={() => setMode('names')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'names'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'glass-panel text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="truncate">Daftar Nama</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'batch'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'glass-panel text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered className="w-4 h-4 shrink-0" />
              <span className="truncate">Nomor Tiket</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('import_events')}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'import_events'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                  : 'glass-panel text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span className="truncate">Kegiatan Lalu</span>
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain touch-auto pr-1 py-3 space-y-3.5 sm:space-y-4">
            {mode === 'names' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ketik Daftar Nama (1 Baris = 1 Peserta):
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={nameListText}
                    onChange={(e) => setNameListText(e.target.value)}
                    placeholder="Contoh:&#10;Dr. Hendra Wijaya, VIP&#10;Siti Aminah, Konsumsi&#10;Ahmad Fauzan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
                  />
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                    Format: <code className="text-sky-400">Nama, Divisi (opsional)</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Divisi / Kategori Default:
                  </label>
                  <input
                    type="text"
                    value={defaultDivision}
                    onChange={(e) => setDefaultDivision(e.target.value)}
                    placeholder="misal: Tamu / Undangan"
                    className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </>
            ) : mode === 'batch' ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Prefix / Nama Label Tiket:
                    </label>
                    <input
                      type="text"
                      required
                      value={batchPrefix}
                      onChange={(e) => setBatchPrefix(e.target.value)}
                      placeholder="misal: Tamu VIP"
                      className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Jumlah Tiket Tamu:
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setBatchCount(Math.max(1, batchCount - 5))}
                        className="px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 active:scale-95 text-xs"
                      >
                        -5
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={batchCount}
                        onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 1)}
                        className="w-24 text-center px-3 py-1.5 sm:py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-sky-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setBatchCount(Math.min(100, batchCount + 5))}
                        className="px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 active:scale-95 text-xs"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Divisi / Kategori Default:
                    </label>
                    <input
                      type="text"
                      value={defaultDivision}
                      onChange={(e) => setDefaultDivision(e.target.value)}
                      placeholder="misal: Tamu / Undangan"
                      className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* mode === 'import_events' */
              <div className="space-y-3.5">
                {/* Source Events Selection (Strictly 2 Previous Events) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Pilih Kegiatan Sumber (Maksimal 2 Sebelumnya):
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sources.length} kegiatan ditemukan
                    </span>
                  </div>

                  {loadingSources ? (
                    <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                      <span>Memeriksa kegiatan sebelumnya...</span>
                    </div>
                  ) : sources.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center py-5">
                      <Calendar className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-300">
                        Tidak ada kegiatan sebelumnya yang memiliki data tiket tamu
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
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
                            className={`p-3 rounded-2xl text-left transition-all border flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? 'bg-sky-950/40 border-sky-500/80 ring-1 ring-sky-500/30'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <span
                                className={`font-semibold text-xs leading-snug line-clamp-1 ${
                                  isSelected ? 'text-white' : 'text-slate-300'
                                }`}
                              >
                                {src.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                                  isSelected ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {src.guest_count} Tamu
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-slate-500" />
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
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nama / ID / divisi tamu..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-sky-500 placeholder:text-slate-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        disabled={unimportedFiltered.length === 0}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold whitespace-nowrap disabled:opacity-40 transition-colors"
                      >
                        {isAllSelected ? 'Batal Semua' : 'Pilih Semua'}
                      </button>
                    </div>

                    {/* QR Reusability Notice */}
                    <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center justify-between">
                      <span className="leading-tight">QR tamu tetap sama & langsung aktif untuk kegiatan ini.</span>
                      <span className="font-bold text-emerald-400 font-mono text-xs shrink-0 ml-2">
                        {selectedMemberIds.size} dipilih
                      </span>
                    </div>

                    {/* Scrollable List of Candidates */}
                    <div className="max-h-52 overflow-y-auto overscroll-contain divide-y divide-slate-800/60 rounded-2xl border border-slate-800 bg-slate-900/40 p-1">
                      {loadingCandidates ? (
                        <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                          <span>Memuat daftar tamu dari kegiatan sumber...</span>
                        </div>
                      ) : filteredCandidates.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
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
                              className={`flex items-center justify-between p-2.5 sm:p-3 min-h-[44px] rounded-xl transition-all ${
                                cand.already_imported
                                  ? 'opacity-40 cursor-not-allowed bg-slate-900/20'
                                  : isSelected
                                  ? 'bg-sky-950/30 cursor-pointer hover:bg-sky-950/40'
                                  : 'hover:bg-slate-800/40 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
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
                                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-white truncate">
                                      {cand.name}
                                    </span>
                                    {cand.division && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium truncate">
                                        {cand.division}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {cand.external_id}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 ml-2">
                                {cand.already_imported ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                    Sudah Ada
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
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

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  (mode === 'import_events' && (selectedMemberIds.size === 0 || sources.length === 0))
                }
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
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
      </div>
    </ModalPortal>
  );
};
