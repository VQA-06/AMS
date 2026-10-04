import React from 'react';
import { Member, SessionType } from '@/shared/types';
import { ModalPortal } from '../ui/ModalPortal';

export interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  manualMemberId: string;
  onMemberChange: (id: string) => void;
  manualSessionType: SessionType;
  onSessionTypeChange: (st: SessionType) => void;
  manualReason: string;
  onReasonChange: (reason: string) => void;
  manualLoading: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  members,
  manualMemberId,
  onMemberChange,
  manualSessionType,
  onSessionTypeChange,
  manualReason,
  onReasonChange,
  manualLoading,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal onClose={onClose}>
 <div className="modal-backdrop-full">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl sm:rounded-3xl glass-panel-elevated border border-slate-700/60 shadow-2xl p-4 sm:p-6 space-y-3.5 sm:space-y-4 my-auto max-h-[92dvh] overflow-y-auto"
        >
          <h3 className="font-heading font-bold text-lg text-white">Input Absensi Manual</h3>
          <p className="text-xs text-slate-400">
            Gunakan jika kamera bermasalah atau anggota hadir secara fisik tanpa tiket QR.
          </p>

          <div>
            <label htmlFor="components-events-manualattendancemodal-field-1" className="block text-xs font-semibold text-slate-300 mb-1">Pilih Anggota:</label>
            <select id="components-events-manualattendancemodal-field-1"
              required
              value={manualMemberId}
              onChange={(e) => onMemberChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:border-sky-500"
            >
              <option value="">-- Pilih Anggota --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.external_id}) {m.division ? `- ${m.division}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="components-events-manualattendancemodal-field-2" className="block text-xs font-semibold text-slate-300 mb-1">Pilih Sesi:</label>
            <select id="components-events-manualattendancemodal-field-2"
              value={manualSessionType}
              onChange={(e) => onSessionTypeChange(e.target.value as SessionType)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:border-sky-500"
            >
              <option value="CHECKIN">CHECK-IN (Masuk)</option>
              <option value="CHECKOUT">CHECK-OUT (Keluar)</option>
              <option value="BREAK_OUT">BREAK OUT (Istirahat Keluar)</option>
              <option value="BREAK_IN">BREAK IN (Istirahat Masuk)</option>
            </select>
          </div>

          <div>
            <label htmlFor="components-events-manualattendancemodal-field-3" className="block text-xs font-semibold text-slate-300 mb-1">
              Alasan Pencatatan Manual <span className="text-rose-400">*</span>:
            </label>
            <textarea id="components-events-manualattendancemodal-field-3"
              required
              value={manualReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="misal: Ponsel anggota mati / lupa membawa tiket QR fisik"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:border-sky-500 min-h-[80px]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={manualLoading}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20"
            >
              {manualLoading ? 'Menyimpan...' : 'Catat Hadir Manual'}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
};
