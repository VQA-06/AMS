import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useAuth } from './hooks/useAuth';
import { MobileShell, TabKey } from './components/layout/MobileShell';
import { OfflineBanner } from './components/common/OfflineBanner';
import { PwaInstallBanner } from './components/pwa/PwaInstallBanner';
import { fetchApi } from './lib/api-client';
import { fetchCached } from './lib/swr-client';
import { Member, Event } from '@/shared/types';
import { ErrorPage } from './pages/ErrorPage';
import { PartialBanner } from './components/ui/PartialBanner';
import { Skeleton } from './components/ui/Skeleton';
import { useResource, type ResourceLoader } from './lib/useResource';

// Route-based Code Splitting: Secondary routes loaded asynchronously on-demand
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const MembersPage = lazy(() => import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })));
const EventsPage = lazy(() => import('./pages/EventsPage').then((m) => ({ default: m.EventsPage })));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage').then((m) => ({ default: m.EventDetailPage })));
const ScannerPage = lazy(() => import('./pages/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MemberTrackerPage = lazy(() => import('./pages/MemberTrackerPage').then((m) => ({ default: m.MemberTrackerPage })));
const QrGeneratorModal = lazy(() => import('./components/qr/QrGeneratorModal').then((m) => ({ default: m.QrGeneratorModal })));

const RouteLoadingFallback: React.FC = () => (
  <div className="mx-auto w-full max-w-[1536px] space-y-4" role="status" aria-live="polite">
    <span className="sr-only">Memuat halaman…</span>
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Skeleton key={`route-kpi-${idx}`} className="h-24 rounded-panel" />
      ))}
    </div>
    <Skeleton className="h-72 rounded-panel" />
  </div>
);

// Helper to parse path from current URL
export function parseRoute(pathname: string, searchStr?: string): { tab: TabKey; eventId: string | null; isLogin: boolean } {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const urlParams = new URLSearchParams(searchStr || (typeof window !== 'undefined' ? window.location.search : ''));

  if (cleanPath === '/login') {
    return { tab: 'dashboard', eventId: null, isLogin: true };
  }
  if (cleanPath === '/' || cleanPath === '/dashboard') {
    return { tab: 'dashboard', eventId: null, isLogin: false };
  }
  if (cleanPath === '/scan' || cleanPath === '/scanner') {
    const eventId = urlParams.get('eventId');
    return { tab: 'scanner', eventId: eventId || null, isLogin: false };
  }
  if (cleanPath === '/members') {
    return { tab: 'members', eventId: null, isLogin: false };
  }
  if (cleanPath === '/tracker' || cleanPath === '/leaderboard') {
    return { tab: 'tracker', eventId: null, isLogin: false };
  }
  if (cleanPath.startsWith('/events/')) {
    const eventId = cleanPath.replace('/events/', '');
    return { tab: 'events', eventId: eventId || null, isLogin: false };
  }
  if (cleanPath === '/events') {
    return { tab: 'events', eventId: null, isLogin: false };
  }
  if (cleanPath === '/settings') {
    return { tab: 'settings', eventId: null, isLogin: false };
  }
  return { tab: '404', eventId: null, isLogin: false };
}

export const App: React.FC = () => {
  const { admin, loading } = useAuth();

  // Route State
  const [currentRoute, setCurrentRoute] = useState<{ tab: TabKey; eventId: string | null; isLogin: boolean }>(
    () => parseRoute(window.location.pathname, window.location.search)
  );

  /**
   * The three boot reads. `useResource` owns the honesty contract: a rejected
   * section is named in `failedSections` and contributes no value, so a
   * backend outage can never render as a plausible zero.
   */
  const loadGlobalData = useCallback<ResourceLoader>(async (force) => {
    const [members, events, divisions] = await Promise.allSettled([
      fetchCached<{ members: Member[]; total: number }>('/api/members?limit=200', {
        forceRefresh: force,
        ttlMs: 15_000,
      }),
      fetchCached<{ events: Event[] }>('/api/agenda', { forceRefresh: force, ttlMs: 15_000 }),
      fetchCached<{ divisions: string[] }>('/api/members/divisions', {
        forceRefresh: force,
        ttlMs: 15_000,
      }),
    ]);

    return [
      ['anggota', members],
      ['kegiatan', events],
      ['divisi', divisions],
    ];
  }, []);

  const global = useResource(loadGlobalData, [admin]);
  const { reload: reloadGlobal } = global;

  /** Pages ask for a refresh that must not serve the 15s cache. */
  const refreshGlobal = useCallback(() => reloadGlobal(true), [reloadGlobal]);

  const memberList = global.data.anggota as { members: Member[] } | undefined;
  const eventList = global.data.kegiatan as { events: Event[] } | undefined;
  const divisionList = global.data.divisi as { divisions: string[] } | undefined;

  const members: Member[] = memberList?.members ?? [];
  const events: Event[] = eventList?.events ?? [];
  const divisions: string[] = divisionList?.divisions ?? [];

  // QR Modal Global Trigger
  const [qrModalMember, setQrModalMember] = useState<Member | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // Trigger add member or create event from dashboard
  const [openAddMemberTrigger, setOpenAddMemberTrigger] = useState<boolean>(false);
  const [openCreateEventTrigger, setOpenCreateEventTrigger] = useState<boolean>(false);
  /** Which global sections failed their last load; drives the honesty banner. */
  const failedSections = global.failed;

  // Listen to popstate (Browser Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(parseRoute(window.location.pathname, window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Programmatic Navigate Helper
  const navigate = useCallback((path: string) => {
    const fullPath = window.location.pathname + window.location.search;
    if (fullPath !== path) {
      window.history.pushState(null, '', path);
    }
    const [pathname, searchStr] = path.split('?');
    setCurrentRoute(parseRoute(pathname, searchStr ? `?${searchStr}` : ''));
  }, []);

  // Online / Offline listener
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Realtime mutation events across tabs, modals, and scanner force a
    // refresh that bypasses the 15s cache.
    const handleMutation = () => {
      reloadGlobal(true);
    };

    window.addEventListener('ams:data-mutated', handleMutation);
    return () => {
      window.removeEventListener('ams:data-mutated', handleMutation);
    };
  }, [reloadGlobal]);

  // Auth Guard Routing Effects - Preserves exact subpage route on refresh
  useEffect(() => {
    if (!loading) {
      if (!admin) {
        // Not logged in -> Redirect to /login
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
          setCurrentRoute(parseRoute('/login'));
        }
      } else {
        // Logged in -> If currently on /login, redirect to /dashboard
        if (window.location.pathname === '/login') {
          window.history.replaceState(null, '', '/dashboard');
          setCurrentRoute(parseRoute('/dashboard'));
        } else {
          // If on a subpage like /events, /members, /scanner, /tracker, ensure route state is preserved
          setCurrentRoute(parseRoute(window.location.pathname, window.location.search));
        }
      }
    }
  }, [admin, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-ink text-paper">
        <div className="surface-raised mb-4 flex h-16 w-16 items-center justify-center rounded-panel p-2 shadow-lift">
          <img src="/logo.webp" alt="AMS Logo" className="h-full w-full object-contain" />
        </div>
        <p className="text-sm font-semibold text-paper/70">
          Memuat AMS (Attendance Management System)…
        </p>
      </div>
    );
  }

  if (!admin) {
    return (
      <>
        <PwaInstallBanner />
        <Suspense fallback={<div className="min-h-[100dvh] bg-paper-sunk" />}>
          <LoginPage onLoginSuccess={() => navigate('/dashboard')} />
        </Suspense>
      </>
    );
  }

  const handleGenerateQrForMember = (member: Member) => {
    setQrModalMember(member);
    setIsQrModalOpen(true);
  };

  const handleScanEvent = (ev: Event) => {
    navigate(`/scan?eventId=${ev.id}`);
  };

  const handleTabChange = (tab: TabKey) => {
    if (tab === 'dashboard') navigate('/dashboard');
    else if (tab === 'members') navigate('/members');
    else if (tab === 'events') navigate('/events');
    else if (tab === 'tracker') navigate('/tracker');
    else if (tab === 'scanner') navigate('/scan');
    else if (tab === 'settings') navigate('/settings');
    else if (tab === '404' || tab === '403') navigate('/dashboard');
  };

  // Resolve selected event if in /events/:id
  const selectedEvent = currentRoute.eventId
    ? events.find((e) => e.id === currentRoute.eventId) || null
    : null;

  return (
    <MobileShell currentTab={currentRoute.tab} onTabChange={handleTabChange}>
      <OfflineBanner />
      <PartialBanner sections={failedSections} className="mb-4" />

      <Suspense fallback={<RouteLoadingFallback />}>
        {currentRoute.tab === 'dashboard' && (
          <DashboardPage
            onNavigate={(tab) => handleTabChange(tab)}
            onNavigateToEvent={(eventId) => navigate(`/events/${eventId}`)}
            onScanEvent={handleScanEvent}
            onOpenAddMember={() => {
              navigate('/members');
              setOpenAddMemberTrigger(true);
            }}
            onOpenCreateEvent={() => {
              navigate('/events');
              setOpenCreateEventTrigger(true);
            }}
          />
        )}

        {currentRoute.tab === 'members' && (
          <MembersPage
            onGenerateQrForMember={handleGenerateQrForMember}
            openAddModalTrigger={openAddMemberTrigger}
            onResetAddModalTrigger={() => setOpenAddMemberTrigger(false)}
            onRefreshGlobal={refreshGlobal}
          />
        )}

        {currentRoute.tab === 'events' && (
          currentRoute.eventId ? (
            <EventDetailPage
              eventId={currentRoute.eventId}
              event={selectedEvent}
              onBack={() => {
                navigate('/events');
                refreshGlobal();
              }}
              onScanEvent={handleScanEvent}
              onRefresh={refreshGlobal}
              members={members}
              divisions={divisions}
              events={events}
            />
          ) : (
            <EventsPage
              onSelectEvent={(ev) => {
                refreshGlobal();
                navigate(`/events/${ev.id}`);
              }}
              onScanEvent={handleScanEvent}
              onEventCreated={() => refreshGlobal()}
              onRefreshGlobal={refreshGlobal}
              openCreateModalTrigger={openCreateEventTrigger}
              onResetCreateModalTrigger={() => setOpenCreateEventTrigger(false)}
            />
          )
        )}

        {currentRoute.tab === 'tracker' && (
          <MemberTrackerPage
            onNavigate={handleTabChange}
            onNavigateToCandidates={() => handleTabChange('members')}
          />
        )}

        {currentRoute.tab === 'scanner' && (
          <ScannerPage
            events={events}
            onRefreshEvents={refreshGlobal}
            initialEventId={currentRoute.eventId}
          />
        )}

        {currentRoute.tab === 'settings' && <SettingsPage />}

        {currentRoute.tab === '404' && (
          <ErrorPage
            code="404"
            onNavigateHome={() => handleTabChange('dashboard')}
          />
        )}

        {currentRoute.tab === '403' && (
          <ErrorPage
            code="403"
            onNavigateHome={() => handleTabChange('dashboard')}
          />
        )}

        {/* Global QR Generator Modal */}
        {isQrModalOpen && (
          <QrGeneratorModal
            isOpen={isQrModalOpen}
            onClose={() => {
              setIsQrModalOpen(false);
              setQrModalMember(null);
              refreshGlobal();
            }}
            preselectedMember={qrModalMember}
            members={members}
            events={events}
            divisions={divisions}
          />
        )}
      </Suspense>

      {/* Mobile-First PWA Installation Banner & Update Prompt */}
      <PwaInstallBanner />
    </MobileShell>
  );
};
