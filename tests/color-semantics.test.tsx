import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EventHeaderSummary } from '../src/client/components/events/EventHeaderSummary';
import { EventList } from '../src/client/components/events/EventList';
import { AttendanceRosterTable } from '../src/client/components/events/AttendanceRosterTable';
import { Attendance, Event } from '../src/shared/types';

const headerProps = {
  onBack: () => {},
  onRefresh: () => {},
  onScanEvent: () => {},
  onOpenManualAttendance: () => {},
  onOpenPrintSheet: () => {},
  onExportAttendance: () => {},
  onDeleteEvent: () => {},
  printableTokensCount: 0,
  isManager: true,
  canExport: true,
};

const makeEvent = (status: Event['status']): Event => ({
  id: 'event-1',
  name: 'Rapat Kerja',
  description: null,
  location_name: 'Aula',
  starts_at: '2025-06-01T09:00:00.000Z',
  ends_at: '2025-06-01T17:00:00.000Z',
  grace_minutes: 15,
  status,
  qr_policy: 'universal_allowed',
  session_modes: ['CHECKIN', 'CHECKOUT'],
  allow_manual_attendance: 1,
  created_at: '2025-05-01T00:00:00.000Z',
  updated_at: '2025-05-01T00:00:00.000Z',
});

const listProps = {
  onSelectEvent: () => {},
  onEditEvent: () => {},
  onActivateEvent: () => {},
  onCloseEvent: () => {},
  onDeleteEvent: () => {},
};

/** Palette hue a status badge actually renders, keyed by its visible text. */
function badgeHuesByText(html: string): Record<string, string> {
  const MARKER = '<span class="inline-flex items-center gap-1.5 border';
  const found: Record<string, string> = {};
  for (let i = html.indexOf(MARKER); i !== -1; i = html.indexOf(MARKER, i + 1)) {
    const next = html.indexOf(MARKER, i + 1);
    const window = html
      .slice(i, next === -1 ? undefined : next)
      .replace(/<svg[\s\S]*?<\/svg>/g, '');
    const hue = window.match(/bg-(emerald|sky|amber|rose|purple|slate)-\d+/);
    const text = window.match(/>([^<>]{2,30})</);
    if (hue && text) found[text[1].trim()] = hue[1];
  }
  return found;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  draft: 'Draft',
  closed: 'Selesai / Tutup',
};

describe('Event status color is identical in the list and the detail header', () => {
  it.each([
    ['active', 'emerald'],
    ['draft', 'slate'],
    ['closed', 'rose'],
  ] as const)('renders %s as %s in both components', (status, expectedHue) => {
    const listHtml = renderToString(
      <EventList events={[makeEvent(status)]} viewMode="table" {...listProps} />
    );
    const headerHtml = renderToString(<EventHeaderSummary event={makeEvent(status)} {...headerProps} />);

    expect(badgeHuesByText(listHtml)[STATUS_LABEL[status]]).toBe(expectedHue);
    expect(Object.values(badgeHuesByText(headerHtml))).toContain(expectedHue);
  });

  it('never renders any event status badge in amber', () => {
    for (const status of ['active', 'draft', 'closed'] as const) {
      const headerHtml = renderToString(
        <EventHeaderSummary event={makeEvent(status)} {...headerProps} />
      );
      const listHtml = renderToString(
        <EventList events={[makeEvent(status)]} viewMode="table" {...listProps} />
      );
      expect(Object.values(badgeHuesByText(headerHtml))).not.toContain('amber');
      expect(Object.values(badgeHuesByText(listHtml))).not.toContain('amber');
    }
  });
});

describe('Session-type badges keep amber reserved for problems', () => {
  const makeAttendance = (sessionType: Attendance['session_type']): Attendance => ({
    id: `att-${sessionType}`,
    event_id: 'event-1',
    member_id: 'mem-1',
    session_type: sessionType,
    qr_token_id: 'tok-1',
    scanned_at: '2025-06-01T09:05:00.000Z',
    station_id: null,
    operator_id: 'scanner-1',
    is_manual: 0,
    meta: '{}',
    member_name: 'Budi Santoso',
    member_external_id: 'MEM-001',
    member_division: 'Engineering',
  });

  const renderRoster = (
    sessionType: Attendance['session_type'],
    mobileViewMode: 'table' | 'card' = 'table'
  ) =>
    renderToString(
      <AttendanceRosterTable
        attendances={[makeAttendance(sessionType)]}
        displayedAttendances={[makeAttendance(sessionType)]}
        totalScanned={1}
        sessionCounts={{ checkin: 1, checkout: 0, breakOut: 0, breakIn: 0 }}
        sessionFilter="ALL"
        onSelectSessionFilter={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedDivision=""
        onDivisionChange={() => {}}
        divisions={[]}
        mobileViewMode={mobileViewMode}
        onToggleMobileViewMode={() => {}}
        selectedAttendanceIds={new Set()}
        onToggleSelectAttendance={() => {}}
        onSelectAllAttendances={() => {}}
        onDeleteAttendanceBatch={() => {}}
        isManager={true}
      />
    );

  it.each(['table', 'card'] as const)(
    'renders a break-out row in purple and a break-in row in slate in %s view',
    (view) => {
      expect(badgeHuesByText(renderRoster('BREAK_OUT', view))['BREAK_OUT']).toBe('purple');
      expect(badgeHuesByText(renderRoster('BREAK_IN', view))['BREAK_IN']).toBe('slate');
    }
  );

  it('keeps check-in and check-out on their state hues with no amber present', () => {
    const hues = [
      ...Object.values(badgeHuesByText(renderRoster('CHECKIN'))),
      ...Object.values(badgeHuesByText(renderRoster('CHECKOUT'))),
    ];
    expect(hues).toContain('emerald');
    expect(hues).toContain('sky');
    expect(hues).not.toContain('amber');
  });
});
