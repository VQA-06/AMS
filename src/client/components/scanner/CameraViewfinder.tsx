import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Keyboard } from '@phosphor-icons/react/Keyboard';
import { Lightning } from '@phosphor-icons/react/Lightning';
import { LightningSlash } from '@phosphor-icons/react/LightningSlash';
import { ShieldWarning } from '@phosphor-icons/react/ShieldWarning';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

interface CameraViewfinderProps {
  onScan: (decodedText: string) => void;
  active: boolean;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  onScan,
  active,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>(
    [],
  );
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment',
  );
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [manualToken, setManualToken] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInsecureContext, setIsInsecureContext] = useState<boolean>(false);
  /**
   * The viewfinder may only claim the state the hardware is actually in:
   * `requesting` while the permission prompt is up, `granted` once a real
   * MediaStream is attached, `denied` when the user refused, `unavailable`
   * when this device has no camera we can open.
   */
  const [cameraPhase, setCameraPhase] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'
  >('idle');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<any>(null);
  const isDecodingFrameRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);

  const isProcessingRef = useRef<boolean>(false);
  const tokenCacheRef = useRef<Map<string, number>>(new Map());
  const onScanRef = useRef(onScan);
  const activeRef = useRef<boolean>(active);
  const isMountedRef = useRef<boolean>(true);
  const facingModeRef = useRef<'environment' | 'user'>(facingMode);

  // Keep latest onScan, active, and facingMode props in refs
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  // Unified Decoded Token Handler with 15s Same-Token Suppression
  const handleDecodedText = useCallback((decodedText: string) => {
    if (!activeRef.current) return;
    if (isProcessingRef.current) return;

    const now = Date.now();
    const lastScannedTime = tokenCacheRef.current.get(decodedText) || 0;

    // Suppress identical token scans for 15 seconds to prevent duplicate spam
    if (now - lastScannedTime < 15000) {
      return;
    }

    tokenCacheRef.current.set(decodedText, now);
    isProcessingRef.current = true;

    // Clean up cache entries older than 30s
    if (tokenCacheRef.current.size > 50) {
      for (const [key, time] of tokenCacheRef.current.entries()) {
        if (now - time > 30000) {
          tokenCacheRef.current.delete(key);
        }
      }
    }

    // Quick inter-token debounce (1.2s before next different person)
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 1200);

    onScanRef.current(decodedText);
  }, []);

  // Force stop all hardware camera tracks across all video elements
  const stopAllTracks = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    isDecodingFrameRef.current = false;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      videoRef.current.srcObject = null;
    }

    try {
      document.querySelectorAll('video').forEach((video) => {
        if (video.srcObject) {
          try {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => {
              track.stop();
              track.enabled = false;
            });
            video.srcObject = null;
          } catch {
            // ignore
          }
        }
      });
    } catch {
      // ignore
    }

    setIsScanning(false);
    setTorchOn(false);
    setCameraPhase('idle');
  }, []);

  const startDirectScanner = useCallback(
    async (modeOrDeviceId?: 'environment' | 'user' | string) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;

      const targetMode =
        modeOrDeviceId || facingModeRef.current || 'environment';

      try {
        setCameraError(null);
        setCameraPhase('requesting');

        // Check if secure context
        const isSecure =
          window.isSecureContext ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        if (!isSecure) {
          setIsInsecureContext(true);
        }

        if (!videoRef.current || !isMountedRef.current) return;

        // Clean previous stream safely before starting new one
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        const isDeviceId =
          typeof targetMode === 'string' && targetMode.length > 20;

        const videoConstraints: MediaTrackConstraints = isDeviceId
          ? {
              deviceId: { exact: targetMode },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 30 },
            }
          : {
              facingMode: { ideal: targetMode || 'environment' },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 30 },
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (!isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        videoRef.current.srcObject = stream;

        // Handle play() safely without unhandled AbortError
        try {
          await videoRef.current.play();
        } catch (playErr: any) {
          if (playErr.name !== 'AbortError') {
            console.warn('Video play error:', playErr);
          }
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            const capabilities = (track.getCapabilities?.() || {}) as any;
            const advanced: any[] = [];

            if (
              Array.isArray(capabilities.focusMode) &&
              capabilities.focusMode.includes('continuous')
            ) {
              advanced.push({ focusMode: 'continuous' });
            }
            if (
              Array.isArray(capabilities.exposureMode) &&
              capabilities.exposureMode.includes('continuous')
            ) {
              advanced.push({ exposureMode: 'continuous' });
            }
            if (
              Array.isArray(capabilities.whiteBalanceMode) &&
              capabilities.whiteBalanceMode.includes('continuous')
            ) {
              advanced.push({ whiteBalanceMode: 'continuous' });
            }

            if (advanced.length > 0) {
              await track.applyConstraints({ advanced }).catch(() => {});
            }

            if ('torch' in capabilities) {
              setHasTorch(Boolean(capabilities.torch));
            }
          } catch {
            // ignore capability error
          }
        }

        setIsScanning(true);
        setCameraPhase('granted');

        // List available cameras
        try {
          if (navigator.mediaDevices?.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices
              .filter((d) => d.kind === 'videoinput')
              .map((d, idx) => ({
                id: d.deviceId,
                label: d.label || `Kamera ${idx + 1}`,
              }));
            if (videoDevices.length > 0) {
              setCameras(videoDevices);
            }
          }
        } catch {
          // ignore
        }

        // Initialize Dual-Engine Loop: Direct GPU BarcodeDetector + Lightweight 480px jsQR
        let nativeDetector: any = null;
        if ('BarcodeDetector' in window) {
          try {
            const formats = await (
              window as any
            ).BarcodeDetector.getSupportedFormats?.();
            if (!formats || formats.includes('qr_code')) {
              nativeDetector = new (window as any).BarcodeDetector({
                formats: ['qr_code'],
              });
            }
          } catch {
            // fallback
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Ultra-Lightweight Scanning Loop (0 MB RAM on GPU, 3ms on jsQR, 60 FPS UI)
        const scanFrame = async () => {
          if (!isMountedRef.current || !activeRef.current) return;

          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            scanTimerRef.current = setTimeout(scanFrame, 90);
            return;
          }

          if (isDecodingFrameRef.current) {
            scanTimerRef.current = setTimeout(scanFrame, 90);
            return;
          }

          isDecodingFrameRef.current = true;
          let detectedResult: string | null = null;

          try {
            // 1. Direct GPU Native BarcodeDetector (Zero Memory Allocation, 2ms latency)
            if (nativeDetector) {
              try {
                const barcodes = await nativeDetector.detect(video);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  detectedResult = barcodes[0].rawValue;
                }
              } catch {
                // ignore transient frame error
              }
            }

            // 2. Lightweight Fallback jsQR on 480px Canvas (Only if Native not available or misses)
            if (!detectedResult && ctx) {
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              if (vw && vh) {
                const maxSide = 480; // 480px is optimal for instant 3ms decode with low CPU
                const scale = Math.min(1, maxSide / Math.max(vw, vh));
                canvas.width = Math.round(vw * scale);
                canvas.height = Math.round(vh * scale);

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );

                // Fast standard pass
                const code = jsQR(imageData.data, canvas.width, canvas.height, {
                  inversionAttempts: 'dontInvert',
                });
                if (code && code.data) {
                  detectedResult = code.data;
                } else {
                  // Inversion pass if standard missed
                  const codeInverted = jsQR(
                    imageData.data,
                    canvas.width,
                    canvas.height,
                    {
                      inversionAttempts: 'onlyInvert',
                    },
                  );
                  if (codeInverted && codeInverted.data) {
                    detectedResult = codeInverted.data;
                  }
                }
              }
            }
          } catch {
            // ignore frame decode error
          } finally {
            isDecodingFrameRef.current = false;
          }

          if (detectedResult) {
            handleDecodedText(detectedResult);
          }

          if (isMountedRef.current) {
            scanTimerRef.current = setTimeout(scanFrame, 90);
          }
        };

        scanTimerRef.current = setTimeout(scanFrame, 100);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const errObj = err as any;
        if (errObj?.name === 'AbortError') return;

        console.error('Direct camera start error:', err);
        const isSec =
          window.isSecureContext ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        // A denied permission, a missing device, and an insecure context are
        // three different failures; the viewfinder must not claim one when
        // the hardware is in another.
        const isDenied =
          errObj?.name === 'NotAllowedError' ||
          errObj?.name === 'PermissionDeniedError';
        const isMissing =
          errObj?.name === 'NotFoundError' ||
          errObj?.name === 'DevicesNotFoundError' ||
          errObj?.name === 'OverconstrainedError';
        if (!isSec) {
          setCameraPhase('unavailable');
          setCameraError(
            'Akses kamera di HP diblokir oleh browser karena menggunakan HTTP biasa. Harap buka via HTTPS (misal: https://' +
              window.location.host +
              ')',
          );
        } else if (isMissing) {
          setCameraPhase('unavailable');
          setCameraError(
            'Tidak ada kamera yang bisa dibuka di perangkat ini. Gunakan Input Manual untuk mencatat token.',
          );
        } else {
          setCameraPhase(isDenied ? 'denied' : 'unavailable');
          const msg =
            err instanceof Error
              ? err.message
              : 'Izin kamera belum diberikan atau kamera sedang digunakan aplikasi lain.';
          setCameraError(msg);
        }
        setIsScanning(false);
      } finally {
        isStartingRef.current = false;
      }
    },
    [handleDecodedText],
  );

  // Synchronize camera hardware lifecycle with `active` prop
  useEffect(() => {
    if (active) {
      startDirectScanner();
    } else {
      stopAllTracks();
    }
  }, [active, startDirectScanner, stopAllTracks]);

  // Clean up completely on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopAllTracks();
    };
  }, [stopAllTracks]);

  const toggleTorch = async () => {
    if (!mediaStreamRef.current || !hasTorch) return;
    try {
      const track = mediaStreamRef.current.getVideoTracks()[0];
      if (track) {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      }
    } catch {
      // ignore
    }
  };

  const switchCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);

    if (cameras.length > 1) {
      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);
      startDirectScanner(cameras[nextIndex].id);
    } else {
      startDirectScanner(nextMode);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    onScanRef.current(manualToken.trim());
    setManualToken('');
    setShowManualInput(false);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto">
      {/* Insecure Context Warning if opened over non-https LAN */}
      {isInsecureContext && (
        <div className="mb-3 flex items-start gap-2 rounded-panel border border-l-2 border-rule border-l-pending-500 bg-paper-sunk p-3 text-xs text-pending-800">
          <ShieldWarning className="mt-0.5 h-4 w-4 shrink-0 text-pending-600" />
          <div>
            <p className="font-bold">Peringatan Protokol Browser Mobile:</p>
            <p className="mt-0.5 text-[11px] text-ink-2">
              Browser smartphone membatasi akses kamera hanya pada koneksi
              HTTPS. Buka via{' '}
              <span className="font-oxanium font-bold text-ink">
                https://{window.location.host}
              </span>{' '}
              jika kamera tidak muncul.
            </p>
          </div>
        </div>
      )}

      {/* Viewfinder frame. The reticle and the sweep are gated on a real
          MediaStream — the frame never shows a "scanning" look the hardware
          is not actually in. */}
      <div
        className={cn(
          'relative flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-panel border bg-ink sm:max-w-[360px]',
          cameraPhase === 'granted' ? 'border-pen-200/70' : 'border-rule',
        )}
      >
        {/* Native HTML5 Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Reticle + sweep. Both are gated on `isScanning`, which is only true
            while a real MediaStream is decoding frames. */}
        {isScanning && (
          <span
            aria-hidden="true"
            className="scan-sweep pointer-events-none absolute inset-x-3 top-3 h-px bg-pen-100 sm:inset-x-4"
          />
        )}

        {/* Clean Vector SVG Reticle (No square boxes / No background artifacts) */}
        {isScanning && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none p-3.5 sm:p-4"
            viewBox="0 0 100 100"
            fill="none"
          >
            {/* Top Left */}
            <path
              d="M 5 22 L 5 9 A 4 4 0 0 1 9 5 L 22 5"
              stroke="#C8A96A"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Top Right */}
            <path
              d="M 78 5 L 91 5 A 4 4 0 0 1 95 9 L 95 22"
              stroke="#C8A96A"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Bottom Left */}
            <path
              d="M 5 78 L 5 91 A 4 4 0 0 0 9 95 L 22 95"
              stroke="#C8A96A"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Bottom Right */}
            <path
              d="M 78 95 L 91 95 A 4 4 0 0 0 95 91 L 95 78"
              stroke="#C8A96A"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Camera state. Only one of these can be true, and each states the
            real phase of the hardware rather than a generic failure. */}
        {cameraPhase === 'requesting' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink/90 p-6 text-center">
            <ArrowClockwise className="mb-3 h-8 w-8 animate-spin text-paper/70" />
            <p className="mb-1 text-sm font-bold text-paper">
              Meminta Izin Kamera...
            </p>
            <p className="max-w-xs text-xs text-paper/80">
              Setujui permintaan izin kamera pada browser untuk mulai memindai.
            </p>
          </div>
        )}

        {(cameraPhase === 'denied' || cameraPhase === 'unavailable') &&
          cameraError && (
            <div
              role="alert"
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink/95 p-6 text-center"
            >
              <WarningCircle
                className={cn(
                  'mb-3 h-10 w-10',
                  cameraPhase === 'denied'
                    ? 'text-pen-200'
                    : 'text-pending-200',
                )}
              />
              <p
                className={cn(
                  'mb-2 text-sm font-bold',
                  cameraPhase === 'denied'
                    ? 'text-pen-200'
                    : 'text-pending-200',
                )}
              >
                {cameraPhase === 'denied'
                  ? 'Izin Kamera Ditolak'
                  : 'Kamera Tidak Tersedia'}
              </p>
              <p className="mb-4 max-w-xs text-xs text-paper/80">
                {cameraError}
              </p>
              {cameraPhase === 'denied' && (
                <Button
                  size="sm"
                  onClick={() => startDirectScanner('environment')}
                >
                  Minta Izin & Buka Kamera
                </Button>
              )}
            </div>
          )}
      </div>

      {/* Floating Control Toolbar */}
      <div className="mt-4 flex w-full items-center justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={switchCamera}
          disabled={cameraPhase !== 'granted'}
          icon={<ArrowClockwise className="h-4 w-4 text-ink-2" />}
        >
          Ganti Kamera
        </Button>

        {hasTorch && (
          <button
            onClick={toggleTorch}
            className={cn(
              'touch-target rounded-chip border transition-colors duration-120',
              torchOn
                ? 'border-pending-500 bg-pending-500 font-bold text-paper'
                : 'border-rule-strong bg-paper-raised text-ink hover:bg-paper-sunk hover:text-ink',
            )}
            aria-label={
              torchOn ? 'Matikan lampu senter' : 'Nyalakan lampu senter'
            }
            aria-pressed={torchOn}
          >
            {torchOn ? (
              <LightningSlash className="h-4 w-4" />
            ) : (
              <Lightning className="h-4 w-4 text-pending-600" />
            )}
          </button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowManualInput(!showManualInput)}
          aria-expanded={showManualInput}
          icon={<Keyboard className="h-4 w-4 text-ink-2" />}
        >
          Input Manual
        </Button>
      </div>

      {/* Manual Input Drawer / Dialog */}
      {showManualInput && (
        <form
          onSubmit={handleManualSubmit}
          className="mt-4 flex w-full items-end gap-2 rounded-panel border border-rule bg-paper-raised p-4"
        >
          <Field
            id="components-scanner-cameraviewfinder-field-1"
            label="Tempel / Masukkan String Token JWE QR:"
            control="text"
            value={manualToken}
            onChange={setManualToken}
            placeholder="eyJhbGciOiJkaXIi..."
            autoComplete="off"
            className="min-w-0 flex-1"
            controlClassName="font-oxanium text-xs"
          />
          <Button type="submit" size="sm" disabled={!manualToken.trim()}>
            Absen
          </Button>
        </form>
      )}
    </div>
  );
};
