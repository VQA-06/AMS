import React, { useState, useEffect } from 'react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { Check } from '@phosphor-icons/react/Check';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { X } from '@phosphor-icons/react/X';
import { Member, Event } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { DigitalPassCard } from './DigitalPassCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { ModalPortal } from '../ui/ModalPortal';

/** One focus quartet across this file: never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

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
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop-full">
        <div className="surface my-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-bezel p-4 shadow-ambient sm:max-h-[88vh] sm:p-6">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rule pb-3 sm:pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-pen-50/70 text-ink-2">
                <QrCode size={20} weight="regular" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-heading text-base font-bold text-ink sm:text-lg">
                  {generatedTokens ? 'Tiket QR Berhasil Dibuat' : 'Generator Tiket QR Terenkripsi'}
                </h3>
                <p className="truncate text-[11px] text-ink-2 sm:text-xs">
                  {generatedTokens
                    ? `Total ${generatedTokens.length} tiket QR siap didistribusikan`
                    : 'Buat token absensi JWE terenkripsi dengan masa aktif'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className={cn(
                'flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-chip bg-paper-raised text-ink-2 transition-colors hover:text-ink',
                focusRing
              )}
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 shrink-0 rounded-panel border border-pen-200 bg-pen-50 px-3 py-2.5 text-xs text-pen-deep"
            >
              {error}
            </div>
          )}

          {generatedTokens ? (
            <div className="no-scrollbar my-3 flex-1 space-y-4 overflow-y-auto pr-1 sm:my-4">
              <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2">
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

              <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-rule pt-3 sm:gap-3 sm:pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setGeneratedTokens(null)}
                >
                  Buat QR Lain
                </Button>
                <Button variant="primary" onClick={onClose}>
                  Selesai
                </Button>
              </div>
            </div>
          ) : (
            /* Generator configuration form */
            <div className="no-scrollbar my-3 flex-1 space-y-3.5 overflow-y-auto pr-1 sm:my-4 sm:space-y-4">
              {/* Scope selection — universal is the community-wide pass, event is
                  bound to one agenda. */}
              <fieldset>
                <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                  Pilih Tipe / Scope QR:
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                  <label
                    htmlFor="components-qr-qrgeneratormodal-field-1"
                    className={cn(
                      'flex cursor-pointer flex-col rounded-panel border p-3 transition-colors sm:p-3.5',
                      focusRing,
                      scope === 'universal'
                        ? 'border-pen-500 bg-pen-50/70'
                        : 'border-rule bg-paper-raised/40 hover:bg-paper-raised/70'
                    )}
                  >
                    <input
                      id="components-qr-qrgeneratormodal-field-1"
                      type="radio"
                      name="qr_scope"
                      value="universal"
                      checked={scope === 'universal'}
                      onChange={() => setScope('universal')}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-1.5 font-oxanium text-xs font-bold text-ink-2">
                      <Sparkle size={14} weight="bold" />
                      <span>QR Universal</span>
                    </span>
                    <span className="mt-1 text-[11px] text-ink-2">
                      Bisa digunakan di seluruh kegiatan yang mengizinkan QR Universal.
                    </span>
                  </label>

                  <label
                    htmlFor="components-qr-qrgeneratormodal-field-2"
                    className={cn(
                      'flex cursor-pointer flex-col rounded-panel border p-3 transition-colors sm:p-3.5',
                      focusRing,
                      scope === 'event'
                        ? 'border-pen-500 bg-pen-50/70'
                        : 'border-rule bg-paper-raised/40 hover:bg-paper-raised/70'
                    )}
                  >
                    <input
                      id="components-qr-qrgeneratormodal-field-2"
                      type="radio"
                      name="qr_scope"
                      value="event"
                      checked={scope === 'event'}
                      onChange={() => setScope('event')}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-1.5 font-oxanium text-xs font-bold text-seal-800">
                      <CalendarBlank size={14} weight="bold" />
                      <span>QR Khusus Event</span>
                    </span>
                    <span className="mt-1 text-[11px] text-ink-2">
                      Terikat ketat ke 1 kegiatan. Ditolak jika dipakai di kegiatan lain.
                    </span>
                  </label>
                </div>
              </fieldset>

              {/* Event picker if scope === 'event' */}
              {scope === 'event' && (
                <Field
                  id="components-qr-qrgeneratormodal-field-3"
                  label="Pilih Kegiatan / Event Terkait:"
                  control="select"
                  value={selectedEventId}
                  onChange={setSelectedEventId}
                  options={events.map((ev) => ({ value: ev.id, label: `${ev.name} (${ev.status})` }))}
                />
              )}

              {/* Validity */}
              {scope === 'universal' ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="components-qr-qrgeneratormodal-field-5"
                    className="block text-[11px] font-semibold uppercase tracking-wide text-ink-2"
                  >
                    Masa Berlaku QR:
                  </label>
                  <div
                    id="components-qr-qrgeneratormodal-field-5"
                    className="flex items-center gap-2 rounded-panel border border-seal-200 bg-seal-50/70 px-3 py-2.5 text-xs font-medium text-seal-800"
                  >
                    <Sparkle size={16} weight="fill" className="shrink-0 text-seal-600" />
                    <span>Permanen / Seumur Hidup (Berlaku selama anggota aktif)</span>
                  </div>
                </div>
              ) : (
                <Field
                  id="components-qr-qrgeneratormodal-field-5"
                  label="Masa Berlaku QR:"
                  control="datetime-local"
                  value={customExpiresAt}
                  onChange={setCustomExpiresAt}
                  controlClassName="font-oxanium tabular-nums"
                />
              )}

              {/* Member multi-select with division filter */}
              <div>
                <div className="mb-2 flex flex-col items-start justify-between gap-1.5 sm:flex-row sm:items-center">
                  <label
                    htmlFor="components-qr-qrgeneratormodal-field-6"
                    className="text-[11px] font-semibold uppercase tracking-wide text-ink-2"
                  >
                    Pilih Anggota ({selectedMemberIds.length} dipilih):
                  </label>
                  <div className="flex items-center gap-2">
                    {divisions.length > 0 && (
                      <select
                        id="components-qr-qrgeneratormodal-field-7"
                        aria-label="Filter divisi"
                        value={filterDivision}
                        onChange={(e) => setFilterDivision(e.target.value)}
                        className={cn(
                          'rounded-chip border border-rule-strong bg-paper-raised px-2 py-1.5 text-[11px] text-ink sm:text-xs',
                          focusRing
                        )}
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
                      className={cn(
                        'rounded-chip px-2 py-1.5 text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink-2 sm:text-xs',
                        focusRing
                      )}
                    >
                      Pilih Semua ({filteredMembers.length})
                    </button>
                  </div>
                </div>

                <ul className="no-scrollbar surface max-h-40 space-y-1.5 overflow-y-auto p-1.5 sm:max-h-48 sm:p-2">
                  {filteredMembers.map((m) => {
                    const selected = selectedMemberIds.includes(m.id);
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => toggleSelectMember(m.id)}
                          aria-pressed={selected}
                          className={cn(
                            'flex w-full items-center justify-between rounded-chip p-2 text-left text-xs transition-colors sm:p-2.5',
                            selected
                              ? 'bg-pen-50/70 text-white'
                              : 'text-ink hover:bg-paper-raised/60'
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                                selected
                                  ? 'border-pen-400 bg-pen-500 text-paper'
                                  : 'border-rule-strong bg-paper-raised'
                              )}
                            >
                              {selected && <Check size={12} weight="bold" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-ink">
                                {m.name}
                              </span>
                              <span className="block truncate font-oxanium text-[10px] text-ink-2 sm:text-[11px]">
                                ID: {m.external_id}
                              </span>
                            </span>
                          </span>

                          {m.division && (
                            <Badge variant="neutral" size="xs" className="ml-2 shrink-0">
                              {m.division}
                            </Badge>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-rule pt-3 sm:gap-3 sm:pt-4">
                <Button variant="ghost" onClick={onClose}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={loading || selectedMemberIds.length === 0}
                  icon={<Sparkle size={16} weight="bold" />}
                >
                  {loading
                    ? 'Membuat QR...'
                    : `Generate QR (${selectedMemberIds.length})`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};
