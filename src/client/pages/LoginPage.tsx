import React, { useState } from 'react';
import { DeviceMobile } from '@phosphor-icons/react/DeviceMobile';
import { DownloadSimple } from '@phosphor-icons/react/DownloadSimple';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { SignIn } from '@phosphor-icons/react/SignIn';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { useAuth } from '../hooks/useAuth';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { feedback } from '../lib/audio-haptic';
import { CameraViewfinder } from '../components/scanner/CameraViewfinder';
import { IosInstallGuideModal } from '../components/pwa/IosInstallGuideModal';
import { Field } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, loginWithQr } = useAuth();
  const { isInstallable, isInstalled, isIos, isNativePromptReady, installApp } = usePwaInstall();
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [installing, setInstalling] = useState<boolean>(false);

  const [loginMode, setLoginMode] = useState<'password' | 'qr'>('password');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string | null>(null);

  const handlePwaInstall = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }
    if (isNativePromptReady) {
      setInstalling(true);
      try {
        await installApp();
      } finally {
        setInstalling(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onLoginSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login gagal. Periksa email atau password Anda.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQrScan = async (decodedText: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setQrStatus('Memverifikasi QR Pass...');

    try {
      await loginWithQr(decodedText.trim());
      feedback.playSuccess();
      setQrStatus('Login berhasil! Mengalihkan...');
      setTimeout(() => {
        onLoginSuccess?.();
      }, 300);
    } catch (err: unknown) {
      feedback.playError();
      const msg = err instanceof Error ? err.message : 'QR Pass tidak valid atau akun belum terdaftar.';
      setError(msg);
      setQrStatus(null);
      setLoading(false);
    }
  };


  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-ink p-4 text-paper">
      <div className="bezel bezel-core w-full max-w-md space-y-6 p-6 sm:p-8">
        {/* Brand Header */}
        <div className="space-y-1.5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-panel border border-rule-strong bg-paper-raised p-2">
            <img src="/logo.webp" alt="AMS Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="pt-1 font-heading text-2xl font-bold text-paper-raised">AMS</h1>
          <p className="text-xs font-semibold text-paper-raised">
            Attendance Management System • Computer Community
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <Tabs
          items={[
            { id: 'password', label: 'Email & Password' },
            { id: 'qr', label: 'Scan QR Pass' },
          ]}
          active={loginMode}
          onChange={(id) => {
            setLoginMode(id === 'qr' ? 'qr' : 'password');
            setError(null);
          }}
          ariaLabel="Metode masuk"
        />

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-panel border border-pen-200 bg-pen-50/70 px-3.5 py-3 text-xs text-pen-deep"
          >
            <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-pen-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Mode 1: Email & Password Form */}
        {loginMode === 'password' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              onDark
              id="pages-loginpage-field-1"
              label="Email / Username:"
              control="text"
              required
              autoComplete="username email"
              value={email}
              onChange={setEmail}
              placeholder="Masukkan email / username"
            />

            <Field
              onDark
              id="pages-loginpage-field-2"
              label="Password:"
              control="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              placeholder="Masukkan password"
            />

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-chip bg-pen-500 px-4 py-3.5 text-sm font-bold text-paper transition-colors duration-120 hover:bg-pen-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-60"
            >
              <SignIn className="h-4 w-4" />
              <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
            </button>
          </form>
        )}

        {/* Mode 2: QR Scanner Mode */}
        {loginMode === 'qr' && (
          <div className="space-y-3">
            <div className="space-y-1 text-center">
              <p className="text-xs text-paper">
                Arahkan kamera ke <strong>QR Universal Anggota</strong> Anda untuk login instan.
              </p>
              {qrStatus && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-center gap-1.5 rounded-chip border border-pen-200 bg-pen-50/70 px-2 py-2 text-xs text-ink-2"
                >
                  <Sparkle className="h-3.5 w-3.5 text-ink-2" />
                  <span>{qrStatus}</span>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-panel border border-rule bg-ink">
              <CameraViewfinder active={loginMode === 'qr' && !loading} onScan={handleQrScan} />
            </div>

            <p className="text-center text-[11px] italic text-paper/70">
              * Login menggunakan QR hanya melakukan autentikasi masuk dan tidak mencatat absensi kegiatan.
            </p>
          </div>
        )}

        {/* Quick PWA Install Button on Login Screen */}
        {!isInstalled && isInstallable && (
          <div className="border-t border-rule pt-3">
            <button
              type="button"
              onClick={handlePwaInstall}
              disabled={installing}
              className="flex w-full items-center justify-center gap-2 rounded-chip border border-pen-200 bg-paper-raised px-3 py-2.5 text-xs font-semibold text-ink transition-colors duration-120 hover:text-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <DeviceMobile className="h-4 w-4 text-ink-2" />
              <span>{installing ? 'Memproses...' : 'Pasang Aplikasi AMS di Perangkat'}</span>
              <DownloadSimple className="h-3.5 w-3.5 text-ink-2" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 border-t border-rule pt-3 text-center text-xs text-paper/70">
          <ShieldCheck className="h-4 w-4 text-paper/70" />
          <span>Computer Community • Database-Secured Authentication</span>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      <IosInstallGuideModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
    </div>
  );
};