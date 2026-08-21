import React, { useState, useEffect } from 'react';
import { X, Calendar, ShieldCheck, ShieldAlert, Save } from 'lucide-react';
import { Event, EventStatus, QrPolicy } from '@/shared/types';
import { EventInput } from '@/shared/schemas/event.schema';
import { ModalPortal } from '../ui/ModalPortal';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventInput) => Promise<void>;
  event?: Event | null;
}

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
    <ModalPortal>
      <div className="modal-backdrop-full animate-in fade-in">
        <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-4 sm:p-6 overflow-hidden max-h-[92dvh] sm:max-h-[85vh] flex flex-col my-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-bold text-base sm:text-lg text-white truncate">
                  {event ? 'Edit Kegiatan / Event' : 'Buat Kegiatan Baru'}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">Atur jadwal, lokasi, dan kebijakan QR</p>
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

          {/* Form Body - Smooth Independent Scrolling */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain touch-auto pr-1 py-3 space-y-3.5 sm:space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Kegiatan <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="misal: Rapat Pleno Divisi 2026"
                className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lokasi / Ruangan
              </label>
              <input
                type="text"
                value={formData.location_name || ''}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                placeholder="misal: Aula Utama / Hall Lt. 2"
                className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Waktu Mulai</label>
                <input
                  type="datetime-local"
                  value={formData.starts_at || ''}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Waktu Selesai</label>
                <input
                  type="datetime-local"
                  value={formData.ends_at || ''}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* QR Policy Radio */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kebijakan Keamanan QR (QR Policy):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <label
                  className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border cursor-pointer transition-all ${
                    formData.qr_policy === 'universal_allowed'
                      ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm'
                      : 'glass-panel border-slate-800 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="qr_policy"
                    value="universal_allowed"
                    checked={formData.qr_policy === 'universal_allowed'}
                    onChange={() => setFormData({ ...formData, qr_policy: 'universal_allowed' })}
                    className="hidden"
                  />
                  <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 text-xs font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>universal_allowed</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    Bisa menggunakan QR Universal atau QR khusus event.
                  </p>
                </label>

                <label
                  className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border cursor-pointer transition-all ${
                    formData.qr_policy === 'event_only'
                      ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm'
                      : 'glass-panel border-slate-800 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="qr_policy"
                    value="event_only"
                    checked={formData.qr_policy === 'event_only'}
                    onChange={() => setFormData({ ...formData, qr_policy: 'event_only' })}
                    className="hidden"
                  />
                  <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 text-xs font-bold text-sky-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>event_only (Ketat)</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    Hanya menerima QR khusus event ini. QR Universal ditolak.
                  </p>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="draft">Draft (Belum Aktif)</option>
                  <option value="active">Active (Bisa Absen)</option>
                  <option value="closed">Closed (Ditutup)</option>
                  <option value="archived">Archived (Diarsipkan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Toleransi Waktu (Menit)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.grace_minutes}
                  onChange={(e) => setFormData({ ...formData, grace_minutes: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allow_manual_attendance === 1}
                  onChange={(e) =>
                    setFormData({ ...formData, allow_manual_attendance: e.target.checked ? 1 : 0 })
                  }
                  className="rounded border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 bg-slate-900 shrink-0"
                />
                <span>Izinkan input absensi manual oleh operator dengan alasan</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>{loading ? 'Menyimpan...' : 'Simpan Kegiatan'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
