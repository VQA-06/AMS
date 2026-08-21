import React, { useState } from 'react';
import { LogIn, ShieldCheck, AlertCircle, Eye, EyeOff, KeyRound, Mail, QrCode, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { feedback } from '../lib/audio-haptic';
import { CameraViewfinder } from '../components/scanner/CameraViewfinder';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, loginWithQr } = useAuth();
  const [loginMode, setLoginMode] = useState<'password' | 'qr'>('password');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string | null>(null);

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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden text-slate-100">
      {/* Background Decorative Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-md rounded-3xl glass-panel-elevated border border-slate-800 p-6 sm:p-8 shadow-2xl relative z-10 space-y-6 transition-all duration-300 ease-out">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-white via-slate-50 to-slate-100 p-2 flex items-center justify-center mx-auto shadow-xl shadow-sky-500/20 border border-white/50 ring-4 ring-white/10">
            <img src="/logo.webp" alt="AMS Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold font-heading bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent pt-1">
            AMS
          </h2>
          <p className="text-xs font-semibold text-sky-400">
            Attendance Management System • Computer Community
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 relative">
          <button
            type="button"
            onClick={() => {
              setLoginMode('password');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              loginMode === 'password'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Email & Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('qr');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              loginMode === 'qr'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Pass</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Mode 1: Email & Password Form */}
        {loginMode === 'password' && (
          <div className="animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  <span>Email / Username:</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan email / username"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                  <span>Password:</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Mode 2: QR Scanner Mode */}
        {loginMode === 'qr' && (
          <div className="animate-in fade-in zoom-in-95 duration-200 space-y-3">
            <div className="text-center space-y-1">
              <p className="text-xs text-slate-300">
                Arahkan kamera ke <strong>QR Universal Anggota</strong> Anda untuk login instan.
              </p>
              {qrStatus && (
                <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-800 text-xs text-sky-300 flex items-center justify-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>{qrStatus}</span>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl bg-slate-950">
              <CameraViewfinder
                active={loginMode === 'qr' && !loading}
                onScan={handleQrScan}
              />
            </div>

            <p className="text-[11px] text-slate-500 text-center italic">
              * Login menggunakan QR hanya melakukan autentikasi masuk dan tidak mencatat absensi kegiatan.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Computer Community • Database-Secured Authentication</span>
        </div>
      </div>
    </div>
  );
};
