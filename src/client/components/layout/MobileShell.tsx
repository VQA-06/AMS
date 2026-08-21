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

  // Desktop sidebar navigation (all 6 items)
  const desktopNavItems: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'dashboard', label: 'Beranda', icon: <LayoutDashboard className="w-5 h-5" /> },
    { key: 'members', label: 'Anggota', icon: <Users className="w-5 h-5" /> },
    { key: 'scanner', label: 'Scan QR', icon: <QrCode className="w-5 h-5" /> },
    { key: 'events', label: 'Kegiatan', icon: <Calendar className="w-5 h-5" /> },
    { key: 'tracker', label: 'Keaktifan', icon: <Activity className="w-5 h-5" /> },
    { key: 'settings', label: 'Pengaturan', icon: <Settings className="w-5 h-5" /> },
  ];

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
      <aside className="hidden md:flex flex-col w-64 h-full shrink-0 glass-panel border-r border-slate-800 p-5 justify-between sticky top-0 z-30 bg-slate-950/95">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-bold font-heading text-lg">
              AMS
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg leading-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                AMS
              </h1>
              <p className="text-xs text-sky-400 font-medium">Computer Community</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {desktopNavItems.map((item) => {
              const active = currentTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onTabChange(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className={active ? 'text-sky-400' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-slate-200 truncate">{admin?.name || 'Admin'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border font-mono ${getRoleInfo(admin?.role).badgeClass}`}>
                  {getRoleInfo(admin?.role).label}
                </span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Independent Scroll Container) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto overflow-x-hidden pb-24 md:pb-6">
        {/* Mobile Top Header */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold font-heading text-xs shadow-md shadow-sky-500/20">
              AMS
            </div>
            <div>
              <h2 className="font-heading font-bold text-base leading-tight">AMS</h2>
              <p className="text-[10px] text-sky-400 leading-none">Computer Community</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border font-mono ${getRoleInfo(admin?.role).badgeClass}`}>
              {getRoleInfo(admin?.role).label}
            </span>
            <button
              onClick={() => onTabChange('settings')}
              className={`p-1.5 rounded-lg transition-colors ${
                currentTab === 'settings'
                  ? 'text-sky-400 bg-sky-950/80 border border-sky-800'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Pengaturan"
              aria-label="Pengaturan"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (True 5-item Symmetric Centered Layout) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40 px-2 py-1.5 pb-safe flex items-center justify-around shadow-2xl overflow-visible">
        {mobileNavItems.map((item) => {
          const active = currentTab === item.key;

          if (item.isScanner) {
            return (
              <button
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className="relative -top-4 flex flex-col items-center group focus:outline-none overflow-visible shrink-0"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-tr from-sky-400 to-blue-600 text-white shadow-sky-500/40 scale-105 ring-4 ring-slate-950'
                      : 'bg-gradient-to-tr from-sky-500 to-blue-700 text-white shadow-sky-950 ring-2 ring-slate-900'
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
              onClick={() => onTabChange(item.key)}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all duration-200 ${
                active ? 'text-sky-400 scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="p-1">{item.icon}</div>
              <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
