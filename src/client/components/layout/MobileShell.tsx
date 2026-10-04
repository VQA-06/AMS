import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  QrCode,
  Settings,
  LogOut,
  Sparkles,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getRoleInfo } from '../../lib/permissions';

export type TabKey = 'dashboard' | 'members' | 'events' | 'tracker' | 'scanner' | 'settings' | '404' | '403' | 'offline';

interface MobileShellProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: React.ReactNode;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { admin, logout } = useAuth();

  // Desktop grouped navigation for enterprise workstation layout
  const desktopNavGroups: Array<{
    title: string;
    items: Array<{ key: TabKey; label: string; icon: React.ReactNode }>;
  }> = [
    {
      title: 'OPERASIONAL',
      items: [
        { key: 'dashboard', label: 'Beranda', icon: <LayoutDashboard className="w-4 h-4" /> },
        { key: 'scanner', label: 'Scan QR Presensi', icon: <QrCode className="w-4 h-4" /> },
        { key: 'events', label: 'Kegiatan', icon: <Calendar className="w-4 h-4" /> },
      ],
    },
    {
      title: 'DATA & KEAKTIFAN',
      items: [
        { key: 'members', label: 'Data Anggota', icon: <Users className="w-4 h-4" /> },
        { key: 'tracker', label: 'Pelacakan Keaktifan', icon: <Activity className="w-4 h-4" /> },
      ],
    },
    {
      title: 'SISTEM',
      items: [
        { key: 'settings', label: 'Pengaturan', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  const tabLabels: Record<TabKey, string> = {
    dashboard: 'Beranda Operasional',
    members: 'Manajemen Anggota',
    scanner: 'Scanner QR Presensi',
    events: 'Kegiatan & Agenda',
    tracker: 'Pelacakan Keaktifan',
    settings: 'Pengaturan Sistem',
    '404': 'Halaman Tidak Ditemukan',
    '403': 'Akses Ditolak',
    offline: 'Mode Offline',
  };

  // Mobile bottom navigation (exact 5 items with Scan QR centered at index 2)
  const mobileNavItems: Array<{ key: TabKey; label: string; icon: React.ReactNode; isScanner?: boolean }> = [
    { key: 'dashboard', label: 'Beranda', icon: <LayoutDashboard className="w-5 h-5" /> },
    { key: 'members', label: 'Anggota', icon: <Users className="w-5 h-5" /> },
    { key: 'scanner', label: 'Scan QR', icon: <QrCode className="w-6 h-6" />, isScanner: true },
    { key: 'events', label: 'Kegiatan', icon: <Calendar className="w-5 h-5" /> },
    { key: 'tracker', label: 'Keaktifan', icon: <Activity className="w-5 h-5" /> },
  ];

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 flex flex-col md:flex-row text-slate-100">
      {/* Desktop Sidebar (Sticky Full Height 100dvh) */}
      <aside className="hidden md:flex flex-col w-64 h-full shrink-0 bg-slate-950/95 border-r border-slate-800 p-5 justify-between sticky top-0 z-30">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-white via-slate-50 to-slate-100 p-1 flex items-center justify-center shadow-lg shadow-sky-500/10 border border-white/40 ring-1 ring-white/20 shrink-0">
              <img src="/logo.webp" alt="AMS Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg leading-tight text-white">AMS</h1>
              <p className="text-xs text-sky-400 font-medium">Computer Community</p>
            </div>
          </div>

          <nav className="space-y-4">
            {desktopNavGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const active = currentTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onTabChange(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        active
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <span className={active ? 'text-sky-400' : 'text-slate-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-slate-200 truncate">{admin?.name || 'Admin'}</p>
              <div className="mt-0.5">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border font-mono ${getRoleInfo(admin?.role).badgeClass}`}>
                  {getRoleInfo(admin?.role).label}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Logout"
              aria-label="Keluar dari akun"
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Independent Scroll Container) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto overflow-x-hidden pb-24 md:pb-6">
        {/* Desktop Workstation Header Bar */}
        <header className="hidden md:flex items-center px-8 py-3 bg-slate-950/80 backdrop-blur border-b border-slate-800/80 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold tracking-wide uppercase text-[10px]">AMS</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-200 font-semibold">{tabLabels[currentTab] || currentTab}</span>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="md:hidden bg-slate-900/95 backdrop-blur border-b border-slate-800/80 sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-white via-slate-50 to-slate-100 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/10 border border-white/40 ring-1 ring-white/20 shrink-0">
              <img src="/logo.webp" alt="AMS Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base leading-tight text-white">AMS</h2>
              <p className="text-[10px] text-sky-400 leading-none font-semibold">Computer Community</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border font-mono ${getRoleInfo(admin?.role).badgeClass}`}>
              {getRoleInfo(admin?.role).label}
            </span>
            <button
              type="button"
              onClick={() => onTabChange('settings')}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                currentTab === 'settings'
                  ? 'text-sky-400 bg-sky-950/80 border border-sky-800'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Pengaturan"
              aria-label="Buka Pengaturan"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Logout"
              aria-label="Keluar dari akun"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1536px] w-full mx-auto">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (True 5-item Ergonomic Dock) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 z-40 px-3 py-1.5 pb-safe flex items-center justify-around shadow-2xl overflow-visible">
        {mobileNavItems.map((item) => {
          const active = currentTab === item.key;

          if (item.isScanner) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className="relative -top-4 flex flex-col items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-2xl overflow-visible shrink-0 touch-target"
                aria-label="Buka Kamera Scanner QR Presensi"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-colors transition-transform duration-200 ${
                    active
                      ? 'bg-sky-500 text-white shadow-sky-500/40 scale-105 ring-4 ring-sky-500/30 ring-offset-2 ring-offset-slate-950'
                      : 'bg-slate-800 text-slate-300 shadow-sky-950 ring-2 ring-sky-500/20 hover:scale-105'
                  }`}
                >
                  <QrCode className="w-7 h-7" />
                </div>
                <span className={`text-[10px] font-bold mt-1 ${active ? 'text-sky-400' : 'text-slate-300'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-2.5 rounded-xl transition-colors transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                active ? 'text-sky-400 font-semibold scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-label={`Buka tab ${item.label}`}
            >
              <div className="p-0.5">{item.icon}</div>
              <span className="text-[10px] font-medium tracking-tight mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
