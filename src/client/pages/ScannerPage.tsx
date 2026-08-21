import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  QrCode,
  Calendar,
  Layers,
  MapPin,
  AlertCircle,
  Sparkles,
  CheckCircle,
  History,
} from 'lucide-react';
import { Event, SessionType } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { feedback } from '../lib/audio-haptic';
import { useAuth } from '../hooks/useAuth';
import { canScanQR } from '../lib/permissions';
import { CameraViewfinder } from '../components/scanner/CameraViewfinder';
import { FloatingScanToast } from '../components/scanner/FloatingScanToast';
import { ScanResultData } from '../components/scanner/ResultModal';
import { RecentScansSheet } from '../components/scanner/RecentScansSheet';

interface ScannerPageProps {
  events: Event[];
  onRefreshEvents: () => void;
  initialEventId?: string | null;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({
  events,
  onRefreshEvents,
  initialEventId,
}) => {
  const { admin } = useAuth();
  const canScan = canScanQR(admin?.role);

  // Filter ONLY active events for scanner operation
  const activeEvents = useMemo(() => events.filter((e) => e.status === 'active'), [events]);

  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    if (initialEventId && activeEvents.some((e) => e.id === initialEventId)) {
      return initialEventId;
    }
    return activeEvents[0]?.id || '';
  });
  const [sessionType, setSessionType] = useState<SessionType>('CHECKIN');
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResultData[]>([]);
  const [isRecentOpen, setIsRecentOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [noEventWarning, setNoEventWarning] = useState<boolean>(false);

  const selectedEventIdRef = useRef<string>(selectedEventId);

  // Always trigger a refresh of events on mount to ensure fresh active events
  useEffect(() => {
    onRefreshEvents();
  }, [onRefreshEvents]);

  // Sync ref with state
  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
    if (selectedEventId) {
      setNoEventWarning(false);
    }
  }, [selectedEventId]);

  // Sync with active events or initialEventId changes
  useEffect(() => {
    if (activeEvents.length > 0) {
      if (initialEventId && activeEvents.some((e) => e.id === initialEventId)) {
        setSelectedEventId(initialEventId);
        selectedEventIdRef.current = initialEventId;
      } else if (!selectedEventId || !activeEvents.some((e) => e.id === selectedEventId)) {
        const defaultId = activeEvents[0].id;
        setSelectedEventId(defaultId);
        selectedEventIdRef.current = defaultId;
      }
    } else {
      setSelectedEventId('');
      selectedEventIdRef.current = '';
    }
  }, [activeEvents, initialEventId, selectedEventId]);

  const currentEvent = activeEvents.find((e) => e.id === selectedEventId);

  const handleScan = async (decodedText: string) => {
    const eventIdToUse = selectedEventIdRef.current || selectedEventId;
    if (!eventIdToUse) {
      setNoEventWarning(true);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetchApi<{
        attendance: {
          id: string;
          memberName: string;
          memberExternalId: string;
          memberDivision?: string | null;
          memberGroup?: string | null;
          eventName: string;
          sessionType: string;
          scannedAt: string;
        };
      }>('/api/scan', {
        method: 'POST',
        body: JSON.stringify({
          eventId: eventIdToUse,
          qr: decodedText.trim(),
          sessionType,
        }),
      });

      // Play High Chime + Haptic Pulse
      feedback.playSuccess();

      const successData: ScanResultData = {
        success: true,
        attendance: res.attendance,
      };

      setScanResult(successData);
      setRecentScans((prev) => [successData, ...prev.slice(0, 19)]);
    } catch (err: unknown) {
      // Play Low Double Buzz + Heavy Vibrate
      feedback.playError();

      const errMsg = err instanceof Error ? err.message : 'QR tidak valid atau absensi ditolak.';
      const code = (err as { code?: string })?.code || 'SCAN_REJECTED';

      const errorData: ScanResultData = {
        success: false,
        code,
        message: errMsg,
      };

      setScanResult(errorData);
      setRecentScans((prev) => [errorData, ...prev.slice(0, 19)]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-8rem)] space-y-4 animate-in fade-in pb-4 relative">
      {/* Non-Blocking Floating Notification Banner */}
      <FloatingScanToast result={scanResult} onDismiss={() => setScanResult(null)} />

      {/* Auditor Read-Only Notice */}
      {!canScan && (
        <div className="w-full max-w-lg p-3.5 rounded-2xl bg-purple-950/80 border border-purple-800/80 text-purple-200 text-xs flex items-start gap-2.5 shadow-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
          <div>
            <span className="font-bold">Mode Peninjau (Auditor)</span>
            <p className="text-[11px] text-purple-300/90 mt-0.5 leading-relaxed">
              Akun Anda memiliki peran <strong>Auditor (Read-Only)</strong>. Pemindaian presensi di lapangan dilakukan oleh <strong>Operator, Admin, atau Owner</strong>. Anda dapat meninjau rekapitulasi data di menu Kegiatan & Pengaturan.
            </p>
          </div>
        </div>
      )}

      {/* Event and Session Controls */}
      <div className="w-full max-w-lg glass-panel-elevated rounded-3xl p-4 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Event Picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Kegiatan Aktif:
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                selectedEventIdRef.current = e.target.value;
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
            >
              {activeEvents.length === 0 && (
                <option value="">-- Tidak ada kegiatan aktif --</option>
              )}
              {activeEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          {/* Session Mode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Tipe Sesi Absen:
            </label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
            >
              <option value="CHECKIN">CHECK-IN (Masuk)</option>
              <option value="CHECKOUT">CHECK-OUT (Keluar)</option>
              <option value="BREAK_OUT">BREAK OUT (Istirahat Keluar)</option>
              <option value="BREAK_IN">BREAK IN (Istirahat Masuk)</option>
            </select>
          </div>
        </div>

        {/* No Event Warning Banner */}
        {noEventWarning && (
          <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Pilih kegiatan / event aktif terlebih dahulu pada pilihan di atas.</span>
          </div>
        )}

        {/* Event policy status indicator & recent button */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                currentEvent?.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            ></span>
            <span className="font-semibold text-slate-300">
              {currentEvent ? `Mode: ${currentEvent.qr_policy}` : 'Pilih Event'}
            </span>
          </div>

          {recentScans.length > 0 && (
            <button
              onClick={() => setIsRecentOpen(true)}
              className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold text-[11px]"
            >
              <History className="w-3.5 h-3.5" />
              <span>{recentScans.length} Riwayat Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Camera Viewfinder - Continuous Active */}
      <div className="w-full flex-1 flex items-center justify-center">
        <CameraViewfinder onScan={handleScan} active={Boolean(selectedEventId)} />
      </div>

      {/* Recent Scans Bottom Sheet */}
      <div className="w-full max-w-lg">
        <RecentScansSheet
          scans={recentScans}
          isOpen={isRecentOpen}
          onToggle={() => setIsRecentOpen(!isRecentOpen)}
        />
      </div>
    </div>
  );
};
