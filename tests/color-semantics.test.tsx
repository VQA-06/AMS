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

/**
 * Status marks only. The header also uses `pending` on the grace-period icon
 * and on an `event_only` policy badge — both genuine warnings about something
 * other than the event's status — so a blanket "no pending anywhere" would
 * forbid correct usage. What must never happen is the *status* claiming the
 * warning mark.
 */
function statusHues(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/data-mark="([a-z]+)"|data-variant="([a-z]+)"/g)].map((m) => m[1] ?? m[2])
    ),
  ];
}

/** Palette hue a status badge actually renders, keyed by its visible text. */
function badgeHuesByText(html: string): Record<string, string> {
  const MARKER = '<span class="inline-flex items-center gap-1.5 border';
  const found: Record<string, string> = {};
  for (let i = html.indexOf(MARKER); i !== -1; i = html.indexOf(MARKER, i + 1)) {
    const next = html.indexOf(MARKER, i + 1);
    const window = html
      .slice(i, next === -1 ? undefined : next)
      .replace(/<svg[\s\S]*?<\/svg>/g, '');
    // Read the rendered hue off the badge's own variant marker, so the test
    // survives a repaint instead of pinning one Tailwind scale.
    const hue = window.match(/data-variant="(seal|pen|pending|danger|info|neutral)"/);
    const text = window.match(/>([^<>]{2,30})</);
    if (hue && text) found[text[1].trim()] = hue[1];
  }
  return found;
}

/**
 * The mark hue carried by the row whose text contains `marker`.
 *
 * In a dense list the row's mark is what encodes state — the design system
 * removes the per-row badge precisely so colour is not duplicated. This reads
 * the mark off the same `data-mark` attribute the `Card`/`TRow` primitives
 * emit, so it tests the rendered contract rather than a Tailwind class name.
 */
function markHueFor(html: string, marker: string): string | undefined {
  const idx = html.indexOf(marker);
  if (idx === -1) return undefined;
  // Walk back to the nearest mark marker at or before this row's text.
  const before = html.slice(0, idx);
  const mark = [...before.matchAll(/data-mark="([a-z]+)"/g)].pop();
  return mark?.[1];
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  draft: 'Draft',
  closed: 'Selesai',
};

describe('Event status colour is identical in the list and the detail header', () => {
  it.each([
    ['active', 'seal'],
    ['draft', 'pending'],
    ['closed', 'danger'],
  ] as const)('renders %s in the %s hue on both surfaces', (status, expectedHue) => {
    const listHtml = renderToString(
      <EventList events={[makeEvent(status)]} {...listProps} />
    );
    const headerHtml = renderToString(
      <EventHeaderSummary event={makeEvent(status)} {...headerProps} />
    );

    // The header keeps a badge (one-off, the text label is the message); the
    // list uses a mark. Both must resolve to the same hue, or colour would
    // encode which screen you are on rather than the state itself.
    const headerBadge = Object.values(badgeHuesByText(headerHtml));
    expect(headerBadge).toContain(expectedHue);
    expect(markHueFor(listHtml, makeEvent(status).name)).toBe(expectedHue);
  });

  it('never renders a live or closed event in the warning hue', () => {
    // `pending` is correct for `draft` (pending work) and wrong for a live or
    // closed event, where it would read as a problem.
    for (const status of ['active', 'closed'] as const) {
      const headerHtml = renderToString(
        <EventHeaderSummary event={makeEvent(status)} {...headerProps} />
      );
      const listHtml = renderToString(
        <EventList events={[makeEvent(status)]} {...listProps} />
      );
      expect(statusHues(headerHtml)).not.toContain('pending');
      expect(statusHues(listHtml)).not.toContain('pending');
    }
  });
});

describe('Session-type colour keeps the warning hue reserved for problems', () => {
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

  const renderRoster = (sessionType: Attendance['session_type']) =>
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
        selectedAttendanceIds={new Set()}
        onToggleSelectAttendance={() => {}}
        onSelectAllAttendances={() => {}}
        onDeleteAttendanceBatch={() => {}}
        onOpenManualAttendance={() => {}}
        isManager={true}
      />
    );

  it.each([
    ['CHECKIN', 'seal'],
    ['CHECKOUT', 'pen'],
  ] as const)('encodes %s as %s in the roster mark', (sessionType, expectedMark) => {
    // The mark replaces the per-row badge here, so this is the only place the
    // session hue can appear. If it regresses to idle, the roster reads uniform.
    expect(markHueFor(renderRoster(sessionType), 'MEM-001')).toBe(expectedMark);
  });

  it.each(['BREAK_OUT', 'BREAK_IN'] as const)('never paints %s in the warning hue', (sessionType) => {
    const hue = markHueFor(renderRoster(sessionType), 'MEM-001');
    expect(hue).toBeDefined();
    // A break is an interruption, never a warning — `pending` here would read
    // as "something is wrong with this person".
    expect(hue).not.toBe('pending');
  });

  it('renders a break-out row and a break-in row in distinct hues', () => {
    // A break-out and a break-in are both interruptions, but the operator
    // still needs to tell them apart at a glance without reading the text.
    const breakOut = markHueFor(renderRoster('BREAK_OUT'), 'MEM-001');
    const breakIn = markHueFor(renderRoster('BREAK_IN'), 'MEM-001');
    expect(breakOut).toBeDefined();
    expect(breakIn).toBeDefined();
    expect(breakOut).not.toBe(breakIn);
  });

  it('keeps check-in and check-out on their state hues with no warning hue present', () => {
    const hues = [
      markHueFor(renderRoster('CHECKIN'), 'MEM-001'),
      markHueFor(renderRoster('CHECKOUT'), 'MEM-001'),
      markHueFor(renderRoster('BREAK_OUT'), 'MEM-001'),
      markHueFor(renderRoster('BREAK_IN'), 'MEM-001'),
    ];
    expect(hues).toContain('seal');
    expect(hues).toContain('pen');
    expect(hues).not.toContain('pending');
  });
});