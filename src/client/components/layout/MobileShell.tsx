import React from 'react';
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank';
import { ChartLineUp } from '@phosphor-icons/react/ChartLineUp';
import { Gear } from '@phosphor-icons/react/Gear';
import { QrCode } from '@phosphor-icons/react/QrCode';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { SquaresFour } from '@phosphor-icons/react/SquaresFour';
import { Users } from '@phosphor-icons/react/Users';
import { useAuth } from '../../hooks/useAuth';
import { getRoleInfo } from '../../lib/permissions';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';
import type { Icon } from '@phosphor-icons/react';

export type TabKey =
  | 'dashboard'
  | 'members'
  | 'events'
  | 'tracker'
  | 'scanner'
  | 'settings'
  | '404'
  | '403'
  | 'offline';

interface MobileShellProps {
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: React.ReactNode;
}
export interface NavItem {
  key: TabKey;
  label: string;
  Icon: Icon;
  isScanner?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

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

/**
 * Desktop nav groups. Scanner is promoted out of OPERASIONAL into its own
 * PERANGKAT group because it is the operator's highest-frequency action and
 * sitting it beside low-frequency read-only views buried it.
 */
export const desktopNavGroups: NavGroup[] = [
  {
    title: 'OPERASIONAL',
    items: [
      { key: 'dashboard', label: 'Dasbor', Icon: SquaresFour },
      { key: 'events', label: 'Kegiatan', Icon: CalendarBlank },
      { key: 'tracker', label: 'Keaktifan', Icon: ChartLineUp },
    ],
  },
  {
    title: 'DATA',
    items: [{ key: 'members', label: 'Anggota', Icon: Users }],
  },
  {
    title: 'PERANGKAT',
    items: [{ key: 'scanner', label: 'Scanner', Icon: QrCode }],
  },
  {
    title: 'SISTEM',
    items: [{ key: 'settings', label: 'Atur', Icon: Gear }],
  },
];

/**
 * The 5-item mobile dock with Scanner centred at index 2 — the scan-first
 * affordance for a one-handed operator, with two items balanced on each side.
 */
export const mobileNavItems: NavItem[] = [
  { key: 'dashboard', label: 'Dasbor', Icon: SquaresFour },
  { key: 'members', label: 'Anggota', Icon: Users },
  { key: 'scanner', label: 'Scanner', Icon: QrCode, isScanner: true },
  { key: 'events', label: 'Kegiatan', Icon: CalendarBlank },
  { key: 'tracker', label: 'Keaktifan', Icon: ChartLineUp },
];

export const tabLabelFor = (tab: TabKey): string => tabLabels[tab] || tab;

/** One logout affordance for both layouts — the old build had two copies. */
const LogoutButton: React.FC<{ onLogout: () => void; size?: 'sm' | 'md' }> = ({
  onLogout,
  size = 'md',
}) => (
  <button
    type="button"
    onClick={onLogout}
    title="Keluar"
    aria-label="Keluar dari akun"
    className={cn(
      'flex items-center justify-center rounded-chip text-paper/70 transition-colors hover:text-paper hover:bg-paper/10',
      focusRing,
      'min-h-[44px] min-w-[44px]'
    )}
  >
    <SignOut size={16} />
  </button>
);

export const MobileShell: React.FC<MobileShellProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { admin, logout } = useAuth();
  const roleInfo = getRoleInfo(admin?.role);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-ink text-paper md:flex-row">
      {/* Desktop sidebar: fixed 264px, four zones, active item carries the rail */}
      <aside className="sticky top-0 z-sticky hidden h-full w-64 shrink-0 flex-col justify-between bg-ink/95 p-5 md:flex">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-panel border border-rule-strong bg-paper-raised p-1">
              <img src="/logo.webp" alt="AMS Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold leading-tight text-paper">AMS</h1>
              <p className="text-xs font-medium text-paper/70">Computer Community</p>
            </div>
          </div>

          <nav className="space-y-5" aria-label="Navigasi utama">
            {desktopNavGroups.map((group) => (
              <div key={group.title}>
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-paper/70">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = currentTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onTabChange(item.key)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-chip px-3 py-2 text-xs font-medium transition-colors duration-120 ease-out-expo',
                          focusRing,
                          active
                            ? 'bg-paper-raised font-semibold text-ink'
                            : 'text-paper/70 hover:bg-paper/80 hover:text-ink'
                        )}
                      >
                        {/* Rail encodes "you are here" — its hue is constant
                            because "active nav" is itself the state. */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            'rail self-stretch',
                            active ? 'bg-pen-500' : 'bg-transparent'
                          )}
                        />
                        <item.Icon size={16} weight={active ? 'fill' : 'regular'} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-rule pt-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0 pr-2">
              <p className="truncate text-xs font-semibold text-paper">
                {admin?.name || 'Admin'}
              </p>
              <Badge variant={roleInfo.variant} size="xs" className="mt-1">
                {roleInfo.label}
              </Badge>
            </div>
            <LogoutButton onLogout={logout} size="sm" />
          </div>
        </div>
      </aside>

      {/* `overflow-x-auto`, not `hidden`: a clipped child is content the user
          can never reach, so a genuine overflow becomes scrollable instead. */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-x-auto overflow-y-auto bg-paper pb-24 md:pb-8">
        {/* One header, both layouts: breadcrumb on desktop, identity + role on mobile. */}
        <header className="sticky top-0 z-bar flex shrink-0 items-center justify-between gap-3 border-b border-rule bg-ink/90 px-4 py-2.5 backdrop-blur-md sm:px-6 md:px-8">
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip border border-rule-strong bg-paper-raised p-0.5">
              <img src="/logo.webp" alt="AMS Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-heading text-base font-bold leading-tight text-paper">AMS</p>
              <p className="text-[10px] font-semibold leading-none text-paper/70">
                Computer Community
              </p>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 text-xs md:flex">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-paper/70">
              AMS
            </span>
            <span className="text-paper/70" aria-hidden="true">
              /
            </span>
            <span className="truncate font-semibold text-paper">
              {tabLabelFor(currentTab)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={roleInfo.variant} size="xs" className="hidden md:inline-flex">
              {roleInfo.label}
            </Badge>
            <button
              type="button"
              onClick={() => onTabChange('settings')}
              aria-label="Buka Pengaturan"
              title="Pengaturan"
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-chip transition-colors md:hidden',
                focusRing,
                currentTab === 'settings'
                  ? 'bg-paper-raised text-ink'
                  : 'text-paper/70 hover:bg-paper-raised/60 hover:text-ink'
              )}
            >
              <Gear size={18} />
            </button>
            <LogoutButton onLogout={logout} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1536px] flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>

      {/* Mobile dock: 5 items, Scanner centred, pb-safe, z above surfaces */}
      <nav
        aria-label="Navigasi bawah"
        className="fixed inset-x-0 bottom-0 z-bar flex items-center justify-around border-t border-rule bg-ink/95 px-3 py-1.5 pb-safe backdrop-blur-lg md:hidden"
      >
        {mobileNavItems.map((item) => {
          const active = currentTab === item.key;

          if (item.isScanner) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                aria-label="Buka Kamera Scanner QR Presensi"
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'touch-target relative -top-4 flex shrink-0 flex-col items-center overflow-visible rounded-panel',
                  focusRing
                )}
              >
                <span
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-panel border transition-transform duration-200',
                    active
                      ? 'rail-pulse border-pen-400 bg-pen-500 text-paper shadow-lift'
                      : 'border-rule-strong bg-paper-raised text-ink'
                  )}
                >
                  <item.Icon size={26} weight="bold" />
                </span>
                <span
                  className={cn(
                    'mt-1 text-[10px] font-bold',
                    active ? 'text-paper' : 'text-paper/70'
                  )}
                >
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
              aria-label={`Buka tab ${item.label}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[48px] min-w-[52px] flex-col items-center justify-center rounded-chip px-2 py-1 transition-colors duration-120 ease-out-expo',
                focusRing,
                active ? 'text-paper' : 'text-paper/70 hover:text-paper'
              )}
            >
              <span className={cn('p-0.5', active && 'rail-pulse rounded-panel')}>
                <item.Icon size={20} weight={active ? 'fill' : 'regular'} />
              </span>
              <span className="mt-0.5 text-[10px] font-medium tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
