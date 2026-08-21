import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { MobileShell, TabKey } from './components/layout/MobileShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { ScannerPage } from './pages/ScannerPage';
import { SettingsPage } from './pages/SettingsPage';
import { MemberTrackerPage } from './pages/MemberTrackerPage';
import { ErrorPage } from './pages/ErrorPage';
import { QrGeneratorModal } from './components/qr/QrGeneratorModal';
import { OfflineBanner } from './components/common/OfflineBanner';
import { fetchApi } from './lib/api-client';
import { Member, Event } from '@/shared/types';

// Helper to parse path from current URL
function parseRoute(pathname: string, searchStr?: string): { tab: TabKey; eventId: string | null; isLogin: boolean } {
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

  // Global cached data
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);

  // QR Modal Global Trigger
  const [qrModalMember, setQrModalMember] = useState<Member | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // Trigger add member or create event from dashboard
  const [openAddMemberTrigger, setOpenAddMemberTrigger] = useState<boolean>(false);
  const [openCreateEventTrigger, setOpenCreateEventTrigger] = useState<boolean>(false);

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

  const loadGlobalData = useCallback(async () => {
    if (!admin) return;
    try {
      const [mRes, eRes, dRes] = await Promise.all([
        fetchApi<{ members: Member[]; total: number }>('/api/members?limit=200').catch(() => ({
          members: [],
          total: 0,
        })),
        fetchApi<{ events: Event[] }>('/api/agenda').catch(() => ({ events: [] })),
        fetchApi<{ divisions: string[] }>('/api/members/divisions').catch(() => ({
          divisions: [],
        })),
      ]);

      setMembers(mRes.members || []);
      setEvents(eRes.events || []);
      setDivisions(dRes.divisions || []);
    } catch (err) {
      console.error('Error loading global data:', err);
    }
  }, [admin]);

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
    loadGlobalData();
  }, [loadGlobalData]);

  // Auth Guard Routing Effects
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
        }
      }
    }
  }, [admin, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-white via-slate-50 to-slate-100 p-2 flex items-center justify-center animate-pulse shadow-xl shadow-sky-500/20 border border-white/50 ring-4 ring-white/10 mb-4">
          <img src="/logo.webp" alt="AMS Logo" className="w-full h-full object-contain" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Memuat AMS (Attendance Management System)...</p>
      </div>
    );
  }

  if (!admin) {
    return <LoginPage onLoginSuccess={() => navigate('/dashboard')} />;
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
          onRefreshGlobal={loadGlobalData}
        />
      )}

      {currentRoute.tab === 'events' && (
        currentRoute.eventId ? (
          <EventDetailPage
            eventId={currentRoute.eventId}
            event={selectedEvent}
            onBack={() => {
              navigate('/events');
              loadGlobalData();
            }}
            onScanEvent={handleScanEvent}
            onRefresh={loadGlobalData}
            members={members}
            divisions={divisions}
            events={events}
          />
        ) : (
          <EventsPage
            onSelectEvent={(ev) => {
              loadGlobalData();
              navigate(`/events/${ev.id}`);
            }}
            onScanEvent={handleScanEvent}
            onEventCreated={() => loadGlobalData()}
            onRefreshGlobal={loadGlobalData}
            openCreateModalTrigger={openCreateEventTrigger}
            onResetCreateModalTrigger={() => setOpenCreateEventTrigger(false)}
          />
        )
      )}

      {currentRoute.tab === 'tracker' && <MemberTrackerPage />}

      {currentRoute.tab === 'scanner' && (
        <ScannerPage
          events={events}
          onRefreshEvents={loadGlobalData}
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
      <QrGeneratorModal
        isOpen={isQrModalOpen}
        onClose={() => {
          setIsQrModalOpen(false);
          setQrModalMember(null);
          loadGlobalData();
        }}
        preselectedMember={qrModalMember}
        members={members}
        events={events}
        divisions={divisions}
      />
    </MobileShell>
  );
};
