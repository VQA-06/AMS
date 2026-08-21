import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Sparkles,
  Calendar,
  Building2,
  Check,
  Download,
  Printer,
  Copy,
} from 'lucide-react';
import { Member, Event } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';
import { DigitalPassCard } from './DigitalPassCard';
import { ModalPortal } from '../ui/ModalPortal';

interface QrGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMember?: Member | null;
  initialEventId?: string;
  preselectedMember?: Member | null;
  preselectedEvent?: Event | null;
  members?: Member[];
  events?: Event[];
  divisions?: string[];
  onSuccess?: () => void;
}

export const QrGeneratorModal: React.FC<QrGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialMember,
  initialEventId,
  preselectedMember,
  preselectedEvent,
  members: propMembers,
  events: propEvents,
  divisions: propDivisions,
  onSuccess,
}) => {
  const targetMember = preselectedMember || initialMember;
  const targetEventId = preselectedEvent?.id || initialEventId;

  const [members, setMembers] = useState<Member[]>(propMembers || []);
  const [events, setEvents] = useState<Event[]>(propEvents || []);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [scope, setScope] = useState<'universal' | 'event'>('universal');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [customExpiresAt, setCustomExpiresAt] = useState<string>('');
  const [filterDivision, setFilterDivision] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Result state after creation
  const [generatedTokens, setGeneratedTokens] = useState<any[] | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (targetMember) {
        setSelectedMemberIds([targetMember.id]);
        if (targetMember.division) {
          setFilterDivision(targetMember.division);
        }
      }
      if (targetEventId) {
        setScope('event');
        setSelectedEventId(targetEventId);
      }
    } else {
      setGeneratedTokens(null);
      setError(null);
    }
  }, [isOpen, targetMember, targetEventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersRes, eventsRes] = await Promise.all([
        fetchApi<{ members: Member[] }>('/api/members?status=active'),
        fetchApi<{ events: Event[] }>('/api/agenda'),
      ]);
      setMembers(membersRes.members || []);
      const activeEvents = (eventsRes.events || []).filter((e) => e.status !== 'archived');
      setEvents(activeEvents);
      if (activeEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(activeEvents[0].id);
      }
    } catch (err: unknown) {
      console.error('Failed to load generator data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const divisions = Array.from(
    new Set(members.map((m) => m.division).filter(Boolean))
  ) as string[];

  const filteredMembers = members.filter((m) => {
    if (!filterDivision) return true;
    return m.division === filterDivision;
  });

  const toggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredMembers.map((m) => m.id);
    const allSelected = allFilteredIds.every((id) => selectedMemberIds.includes(id));
    if (allSelected) {
      setSelectedMemberIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleGenerate = async () => {
    if (selectedMemberIds.length === 0) {
      setError('Pilih minimal satu anggota untuk membuat QR');
      return;
    }

    if (scope === 'event' && !selectedEventId) {
      setError('Pilih kegiatan untuk QR khusus event');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        member_ids: selectedMemberIds,
        scope,
        event_id: scope === 'event' ? selectedEventId : null,
        expires_at: scope === 'event' ? customExpiresAt || null : null,
      };

      const res = await fetchApi<{ tokens: any[] }>('/api/qr/batch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setGeneratedTokens(res.tokens || []);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat QR token';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const currentEvent = events.find((e) => e.id === selectedEventId);

  return (
    <ModalPortal>
      <div className="modal-backdrop-full animate-in fade-in">
        <div className="w-full max-w-2xl rounded-2xl sm:rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-4 sm:p-6 overflow-hidden max-h-[92dvh] sm:max-h-[88vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-base sm:text-lg text-white truncate">
                {generatedTokens ? 'Tiket QR Berhasil Dibuat' : 'Generator Tiket QR Terenkripsi'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {generatedTokens
                  ? `Total ${generatedTokens.length} tiket QR siap didistribusikan`
                  : 'Buat token absensi JWE terenkripsi dengan masa aktif'}
              </p>
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

        {/* Generated Tokens Display */}
        {generatedTokens ? (
          <div className="flex-1 overflow-y-auto my-3 sm:my-4 space-y-4 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 justify-items-center">
              {generatedTokens.map((tok) => (
                <DigitalPassCard
                  key={tok.id}
                  tokenString={tok.qr_token}
                  memberName={tok.member_name}
                  memberExternalId={tok.member_external_id}
                  memberDivision={tok.member_division}
                  eventName={scope === 'event' ? currentEvent?.name : null}
                  scope={tok.scope}
                  expiresAt={tok.expires_at}
                />
              ))}
            </div>

            <div className="pt-3 sm:pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setGeneratedTokens(null)}
                className="px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Buat QR Lain
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 sm:py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        ) : (
          /* Generator Configuration Form */
          <div className="flex-1 overflow-y-auto overscroll-contain touch-auto my-3 sm:my-4 space-y-3.5 sm:space-y-4 pr-1">
            {/* Scope Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Pilih Tipe / Scope QR:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <label
                  className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border cursor-pointer transition-all ${
                    scope === 'universal'
                      ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm'
                      : 'glass-panel border-slate-800 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="qr_scope"
                    value="universal"
                    checked={scope === 'universal'}
                    onChange={() => setScope('universal')}
                    className="hidden"
                  />
                  <p className="font-bold text-xs text-sky-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>QR Universal</span>
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
                    Bisa digunakan di seluruh kegiatan yang mengizinkan QR Universal.
                  </p>
                </label>

                <label
                  className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border cursor-pointer transition-all ${
                    scope === 'event'
                      ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm'
                      : 'glass-panel border-slate-800 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="qr_scope"
                    value="event"
                    checked={scope === 'event'}
                    onChange={() => setScope('event')}
                    className="hidden"
                  />
                  <p className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>QR Khusus Event</span>
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
                    Terikat ketat ke 1 kegiatan. Ditolak jika dipakai di kegiatan lain.
                  </p>
                </label>
              </div>
            </div>

            {/* Event Picker if scope == 'event' */}
            {scope === 'event' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Kegiatan / Event Terkait:
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Validity Duration */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Masa Berlaku QR:
              </label>
              {scope === 'universal' ? (
                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-400 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Permanen / Seumur Hidup (Berlaku selama anggota aktif)</span>
                </div>
              ) : (
                <input
                  type="datetime-local"
                  value={customExpiresAt}
                  onChange={(e) => setCustomExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              )}
            </div>

            {/* Member Multi-Select with Division Filter */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Pilih Anggota ({selectedMemberIds.length} dipilih):
                </label>
                <div className="flex items-center gap-2">
                  {divisions.length > 0 && (
                    <select
                      value={filterDivision}
                      onChange={(e) => setFilterDivision(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] sm:text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="">Semua Divisi</option>
                      {divisions.map((div, i) => (
                        <option key={i} value={div}>
                          {div}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[11px] sm:text-xs font-semibold text-sky-400 hover:text-sky-300"
                  >
                    Pilih Semua ({filteredMembers.length})
                  </button>
                </div>
              </div>

              <div className="glass-panel rounded-xl sm:rounded-2xl border border-slate-800 max-h-40 sm:max-h-48 overflow-y-auto p-1.5 sm:p-2 space-y-1.5">
                {filteredMembers.map((m) => {
                  const selected = selectedMemberIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleSelectMember(m.id)}
                      className={`p-2 sm:p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all text-xs ${
                        selected
                          ? 'bg-sky-500/20 text-white border border-sky-500/40'
                          : 'hover:bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-sky-500 border-sky-400 text-slate-950'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-200 truncate">{m.name}</p>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">ID: {m.external_id}</p>
                        </div>
                      </div>

                      {m.division && (
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40 text-[9px] sm:text-[10px] font-semibold shrink-0 ml-2">
                          <Building2 className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[80px]">{m.division}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-end gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || selectedMemberIds.length === 0}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  {loading
                    ? 'Membuat QR...'
                    : `Generate QR (${selectedMemberIds.length})`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </ModalPortal>
);
};
