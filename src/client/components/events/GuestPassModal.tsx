import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Users,
  Sparkles,
  CheckCircle2,
  Building2,
  ListOrdered,
} from 'lucide-react';
import { Event } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';

interface GuestPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  onSuccess: (tokens: any[]) => void;
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
  const [defaultDivision, setDefaultDivision] = useState<string>('Tamu');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let body: any = {};

      if (mode === 'names') {
        const lines = nameListText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          setError('Masukkan minimal 1 nama peserta tamu.');
          setLoading(false);
          return;
        }

        const guests = lines.map((line) => {
          const parts = line.split(/[,|;]/).map((p) => p.trim());
          return {
            name: parts[0],
            division: parts[1] || defaultDivision || null,
          };
        });

        body = { guests };
      } else {
        if (batchCount <= 0) {
          setError('Jumlah tiket minimal 1.');
          setLoading(false);
          return;
        }

        body = {
          count: batchCount,
          prefix: batchPrefix.trim() || 'Tamu',
          division: defaultDivision || 'Tamu',
        };
      }

      const res = await fetchApi<{ tokens: any[] }>(`/api/events/${event.id}/guests`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      onSuccess(res.tokens || []);
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
      <div className="w-full max-w-lg rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white">
                Buat Peserta Tamu / Sementara
              </h3>
              <p className="text-xs text-slate-400">Khusus untuk event: {event.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setMode('names')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'names'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'glass-panel text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Nama Tamu</span>
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
            <ListOrdered className="w-4 h-4" />
            <span>Batch Nomor Tiket</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === 'names' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ketik Daftar Nama (1 Baris = 1 Peserta):
              </label>
              <textarea
                rows={5}
                required
                value={nameListText}
                onChange={(e) => setNameListText(e.target.value)}
                placeholder="Contoh:&#10;Dr. Hendra Wijaya, VIP&#10;Siti Aminah, Konsumsi&#10;Ahmad Fauzan"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
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
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 active:scale-95"
                  >
                    -5
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 1)}
                    className="w-24 text-center px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setBatchCount(Math.min(100, batchCount + 5))}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 active:scale-95"
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Membuat Tiket...' : 'Buat Tiket QR Tamu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
