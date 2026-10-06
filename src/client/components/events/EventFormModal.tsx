import React, { useState, useEffect } from 'react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { FloppyDisk } from '@phosphor-icons/react/FloppyDisk';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { ShieldWarning } from '@phosphor-icons/react/ShieldWarning';
import { X } from '@phosphor-icons/react/X';
import { Event, EventStatus, QrPolicy } from '@/shared/types';
import { EventInput } from '@/shared/schemas/event.schema';
import { ModalPortal } from '../ui/ModalPortal';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { cn } from '../../lib/cn';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventInput) => Promise<void>;
  event?: Event | null;
}

/** The one focus quartet on the hand-rolled radio cards in this file. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  event,
}) => {
  const [formData, setFormData] = useState<EventInput>({
    name: '',
    description: '',
    location_name: '',
    starts_at: '',
    ends_at: '',
    qr_policy: 'universal_allowed',
    status: 'draft',
    session_modes: '["CHECKIN"]',
    allow_manual_attendance: 0,
    grace_minutes: 30,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        description: event.description || '',
        location_name: event.location_name || '',
        starts_at: event.starts_at || '',
        ends_at: event.ends_at || '',
        qr_policy: event.qr_policy || 'universal_allowed',
        status: event.status,
        session_modes: typeof event.session_modes === 'string' ? event.session_modes : JSON.stringify(event.session_modes || ['CHECKIN']),
        allow_manual_attendance: event.allow_manual_attendance ? 1 : 0,
        grace_minutes: event.grace_minutes || 30,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        location_name: '',
        starts_at: '',
        ends_at: '',
        qr_policy: 'universal_allowed',
        status: 'draft',
        session_modes: '["CHECKIN"]',
        allow_manual_attendance: 0,
        grace_minutes: 30,
      });
    }
    setError(null);
  }, [event, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSave(formData);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan kegiatan.';
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
          {/* Header — no rail: the panel's state is not variable per-row. */}
          <div className="flex shrink-0 items-center justify-between border-b border-rule pb-2.5 sm:pb-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip border border-pen-200 bg-pen-50/70 text-ink-2 sm:h-9 sm:w-9">
                <CalendarBlank className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-heading text-base font-bold text-ink sm:text-lg">
                  {event ? 'Edit Kegiatan / Event' : 'Buat Kegiatan Baru'}
                </h3>
                <p className="truncate text-[11px] text-ink-2 sm:text-xs">
                  Atur jadwal, lokasi, dan kebijakan QR
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className={cn(
                'shrink-0 rounded-chip bg-paper-raised p-1.5 text-ink-2 transition-colors hover:bg-paper-raised/80 hover:text-ink sm:p-2',
                focusRing
              )}
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-2.5 shrink-0 rounded-panel border border-pen-200 bg-pen-50 p-2.5 text-xs text-pen-deep sm:mt-3 sm:p-3"
            >
              {error}
            </div>
          )}

          {/* Form Body - Smooth Independent Scrolling */}
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 py-3 sm:space-y-4 sm:py-4">
            <Field
              id="components-events-eventformmodal-field-1"
              label="Nama Kegiatan"
              control="text"
              required
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder="misal: Rapat Pleno Divisi 2026"
            />

            <Field
              id="components-events-eventformmodal-field-2"
              label="Lokasi / Ruangan"
              control="text"
              value={formData.location_name || ''}
              onChange={(v) => setFormData({ ...formData, location_name: v })}
              placeholder="misal: Aula Utama / Hall Lt. 2"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Field
                id="components-events-eventformmodal-field-3"
                label="Waktu Mulai"
                control="datetime-local"
                value={formData.starts_at || ''}
                onChange={(v) => setFormData({ ...formData, starts_at: v })}
                controlClassName="text-xs sm:text-sm"
              />

              <Field
                id="components-events-eventformmodal-field-4"
                label="Waktu Selesai"
                control="datetime-local"
                value={formData.ends_at || ''}
                onChange={(v) => setFormData({ ...formData, ends_at: v })}
                controlClassName="text-xs sm:text-sm"
              />
            </div>

            {/* QR Policy Radio — a radiogroup, so the group carries the name and
                each option a real label rather than a hidden input. */}
            <fieldset>
              <legend className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                Kebijakan Keamanan QR (QR Policy):
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className={cn(
                    'cursor-pointer rounded-panel border p-3 transition-colors',
                    focusRing,
                    formData.qr_policy === 'universal_allowed'
                      ? 'border-pen-500 bg-pen-50/70 text-ink'
                      : 'border-rule bg-paper text-ink-2 hover:bg-paper-raised'
                  )}
                >
                  <input
                    type="radio"
                    name="qr_policy"
                    value="universal_allowed"
                    checked={formData.qr_policy === 'universal_allowed'}
                    onChange={() => setFormData({ ...formData, qr_policy: 'universal_allowed' as QrPolicy })}
                    className="sr-only"
                  />
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-seal-800">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>universal_allowed</span>
                  </div>
                  <p className="text-[10px] text-ink-2 sm:text-[11px]">
                    Bisa menggunakan QR Universal atau QR khusus event.
                  </p>
                </label>

                <label
                  className={cn(
                    'cursor-pointer rounded-panel border p-3 transition-colors',
                    focusRing,
                    formData.qr_policy === 'event_only'
                      ? 'border-pen-500 bg-pen-50/70 text-ink'
                      : 'border-rule bg-paper text-ink-2 hover:bg-paper-raised'
                  )}
                >
                  <input
                    type="radio"
                    name="qr_policy"
                    value="event_only"
                    checked={formData.qr_policy === 'event_only'}
                    onChange={() => setFormData({ ...formData, qr_policy: 'event_only' as QrPolicy })}
                    className="sr-only"
                  />
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink-2">
                    <ShieldWarning className="h-4 w-4 shrink-0" />
                    <span>event_only (Ketat)</span>
                  </div>
                  <p className="text-[10px] text-ink-2 sm:text-[11px]">
                    Hanya menerima QR khusus event ini. QR Universal ditolak.
                  </p>
                </label>
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="components-events-eventformmodal-field-6"
                label="Status"
                control="select"
                value={formData.status}
                onChange={(v) => setFormData({ ...formData, status: v as EventStatus })}
                options={[
                  { value: 'draft', label: 'Draft (Belum Aktif)' },
                  { value: 'active', label: 'Active (Bisa Absen)' },
                  { value: 'closed', label: 'Closed (Ditutup)' },
                  { value: 'archived', label: 'Archived (Diarsipkan)' },
                ]}
              />

              <Field
                id="components-events-eventformmodal-field-7"
                label="Toleransi Waktu (Menit)"
                control="number"
                hint="grace_minutes — waktu absensi tetap diterima setelah kegiatan berakhir."
                value={String(formData.grace_minutes)}
                onChange={(v) =>
                  setFormData({ ...formData, grace_minutes: Math.max(0, parseInt(v, 10) || 0) })
                }
              />
            </div>

            <Field
              id="components-events-eventformmodal-field-8"
              label="Presensi Manual"
              control="checkbox"
              hint="allow_manual_attendance — izinkan operator mencatat absensi manual dengan alasan."
              value={String(formData.allow_manual_attendance === 1)}
              onChange={(v) => setFormData({ ...formData, allow_manual_attendance: v === 'true' ? 1 : 0 })}
              placeholder="Izinkan input absensi manual oleh operator dengan alasan"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-rule pt-3 sm:gap-3 sm:pt-4">
            <Button variant="ghost" type="button" onClick={onClose}>
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={loading}
              icon={<FloppyDisk className="h-4 w-4 shrink-0" />}
            >
              {loading ? 'Menyimpan...' : 'Simpan Kegiatan'}
            </Button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
};