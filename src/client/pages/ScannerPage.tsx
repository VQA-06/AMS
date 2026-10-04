import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react/ClockCounterClockwise';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { Event, SessionType } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { feedback } from '../lib/audio-haptic';
import { cn } from '../lib/cn';
import { useAuth } from '../hooks/useAuth';
import { canScanQR } from '../lib/permissions';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { CameraViewfinder } from '../components/scanner/CameraViewfinder';
import { FloatingScanToast } from '../components/scanner/FloatingScanToast';
import { ScanResultData } from '../components/scanner/ResultModal';
import { RecentScansSheet } from '../components/scanner/RecentScansSheet';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

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
  const activeEvents = useMemo(
    () => events.filter((e) => e.status === 'active'),
    [events],
  );

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
      } else if (
        !selectedEventId ||
        !activeEvents.some((e) => e.id === selectedEventId)
      ) {
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

      const errMsg =
        err instanceof Error
          ? err.message
          : 'QR tidak valid atau absensi ditolak.';
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
    <div className="relative flex min-h-[calc(100vh-8rem)] flex-col items-center space-y-5 pb-4 md:space-y-8">
      {/* Non-Blocking Floating Notification Banner */}
      <FloatingScanToast
        result={scanResult}
        onDismiss={() => setScanResult(null)}
      />

      <div className="w-full max-w-lg">
        <PageHeader
          title="Scanner"
          subtitle="Pindai QR anggota untuk mencatat presensi kegiatan aktif."
        />

        <div className="space-y-5 md:space-y-8">
          {/* Auditor Read-Only Notice */}
          {!canScan && (
            <div className="surface flex items-start gap-2.5 rounded-panel p-3.5 text-xs text-ink">
              <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
              <div>
                <span className="font-bold text-ink">
                  Mode Peninjau (Auditor)
                </span>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-2">
                  Akun Anda memiliki peran <strong>Auditor (Read-Only)</strong>.
                  Pemindaian presensi di lapangan dilakukan oleh{' '}
                  <strong>Operator, Admin, atau Owner</strong>. Anda dapat
                  meninjau rekapitulasi data di menu Kegiatan &amp; Pengaturan.
                </p>
              </div>
            </div>
          )}

          {/* Event and Session Controls */}
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="pages-scannerpage-field-1"
                label="Kegiatan Aktif:"
                control="select"
                value={selectedEventId}
                onChange={(v) => {
                  setSelectedEventId(v);
                  selectedEventIdRef.current = v;
                }}
                controlClassName="min-h-[44px] cursor-pointer text-xs font-semibold"
                options={[
                  ...(activeEvents.length === 0
                    ? [{ value: '', label: '-- Tidak ada kegiatan aktif --' }]
                    : []),
                  ...activeEvents.map((ev) => ({ value: ev.id, label: ev.name })),
                ]}
              />
              <Field
                id="pages-scannerpage-field-2"
                label="Tipe Sesi Absen:"
                control="select"
                value={sessionType}
                onChange={(v) => setSessionType(v as SessionType)}
                controlClassName="min-h-[44px] cursor-pointer text-xs font-semibold"
                options={[
                  { value: 'CHECKIN', label: 'CHECK-IN (Masuk)' },
                  { value: 'CHECKOUT', label: 'CHECK-OUT (Keluar)' },
                  { value: 'BREAK_OUT', label: 'BREAK OUT (Istirahat Keluar)' },
                  { value: 'BREAK_IN', label: 'BREAK IN (Istirahat Masuk)' },
                ]}
              />
            </div>

            {/* No Event Warning Banner */}
            {noEventWarning && (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 flex items-center gap-2 rounded-panel border border-pending-200/70 bg-pending-500/10 p-3 text-xs text-pending-800"
              >
                <WarningCircle className="h-4 w-4 shrink-0 text-pending-600" />
                <span>
                  Pilih kegiatan / event aktif terlebih dahulu pada pilihan di
                  atas.
                </span>
              </div>
            )}

            {/* Event policy status indicator & recent button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-ink-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    // Genuinely ongoing state: the dot pulses only while an
                    // event is live.
                    currentEvent?.status === 'active'
                      ? 'animate-pulse bg-seal-400'
                      : 'bg-pending-400',
                  )}
                />
                <span className="truncate font-semibold text-ink">
                  {currentEvent
                    ? `Mode: ${currentEvent.qr_policy}`
                    : 'Pilih Event'}
                </span>
              </div>

              {recentScans.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRecentOpen(true)}
                  aria-label={`Buka riwayat ${recentScans.length} scan terakhir`}
                  icon={
                    <ClockCounterClockwise className="h-4 w-4 text-ink-2" />
                  }
                >
                  {recentScans.length} Scan
                </Button>
              )}
            </div>
          </Card>

          <CameraViewfinder onScan={handleScan} active={canScan} />
        </div>
      </div>

      <RecentScansSheet
        scans={recentScans}
        isOpen={isRecentOpen}
        onToggle={() => setIsRecentOpen(!isRecentOpen)}
      />
    </div>
  );
};
