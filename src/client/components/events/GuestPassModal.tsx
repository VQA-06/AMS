import React, { useState } from 'react';
import { X, UserPlus, Sparkles, Users, ListOrdered } from 'lucide-react';
import { Event } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';

interface GuestPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  onSuccess: () => void;
}

export const GuestPassModal: React.FC<GuestPassModalProps> = ({
  isOpen,
  onClose,
  event,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'names' | 'batch'>('names');
  const [nameListText, setNameListText] = useState<string>('');
  const [batchPrefix, setBatchPrefix] = useState<string>('Tamu Undangan');
  const [batchCount, setBatchCount] = useState<number>(10);
  const [defaultDivision, setDefaultDivision] = useState<string>('Tamu Undangan');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

        await fetchApi(`/api/events/${event.id}/guests/batch-names`, {
          method: 'POST',
          body: JSON.stringify({ items }),
        });
      } else {
        if (batchCount < 1 || batchCount > 100) {
          throw new Error('Jumlah batch harus antara 1 sampai 100.');
        }

        await fetchApi(`/api/events/${event.id}/guests/batch`, {
          method: 'POST',
          body: JSON.stringify({
            count: batchCount,
            prefix: batchPrefix || 'Tamu Undangan',
            division: defaultDivision || 'Tamu Undangan',
          }),
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat tiket tamu.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop-full animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-4 sm:p-6 overflow-hidden max-h-[92dvh] sm:max-h-[85vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-base sm:text-lg text-white truncate">
                Buat Peserta Tamu / Sementara
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

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 mt-3 sm:mt-4 shrink-0">
          <button
            type="button"
            onClick={() => setMode('names')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'batch'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'glass-panel text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-4 h-4 shrink-0" />
            <span className="truncate">Nomor Tiket</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 py-3 space-y-3.5 sm:space-y-4">
          {mode === 'names' ? (
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
          ) : (
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
            </div>
          )}

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
              disabled={loading}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{loading ? 'Membuat Tiket...' : 'Buat Tiket QR Tamu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
