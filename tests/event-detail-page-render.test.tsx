import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ArrowClockwise, Users, QrCode } from '@phosphor-icons/react';
import { Button } from '../src/client/components/ui/Button';
import { Badge } from '../src/client/components/ui/Badge';
import { EventHeaderSummary } from '../src/client/components/events/EventHeaderSummary';
import { AttendanceRosterTable } from '../src/client/components/events/AttendanceRosterTable';
import { GuestPassWorkspace } from '../src/client/components/events/GuestPassWorkspace';
import { Event, Attendance, QrToken } from '../src/shared/types';
import { filterPrintableTokens } from '../src/client/lib/qr-tokens';

/** Fixed clock so expiry never depends on when the suite runs. */
const NOW = new Date('2026-01-15T00:00:00.000Z').getTime();

const baseToken = {
  qr_token: 'valid-jwt',
  jti: 'jti',
  member_id: 'guest-1',
  event_id: 'event-1',
  scope: 'event' as const,
  valid_from: '2025-06-01T00:00:00.000Z',
  expires_at: '2030-01-01T00:00:00.000Z',
  revoked_at: null,
  max_uses: 1,
  uses_count: 0,
  note: null,
  created_by: 'admin-1',
  created_at: '2025-06-01T00:00:00.000Z',
};

const sampleTokens: QrToken[] = [
  { ...baseToken, id: 'tok-1', member_name: 'Guest One', member_external_id: 'GUEST-001', member_division: 'VIP' },
  { ...baseToken, id: 'tok-2', qr_token: 'valid-jwt-2', member_name: 'Guest Two', member_external_id: 'GUEST-002', member_division: 'Media' },
  { ...baseToken, id: 'tok-3', revoked_at: '2025-06-01T12:00:00.000Z' },
  { ...baseToken, id: 'tok-4', expires_at: '2025-01-01T00:00:00.000Z' },
  { ...baseToken, id: 'tok-5', qr_token: null },
];

describe('EventDetailPage Subcomponents & Primitives Render Verification', () => {
  it('should render Button with outline variant and both element and component icons without error', () => {
    // Render with JSX element icon
    const htmlWithElement = renderToString(
      <Button variant="outline" size="sm" icon={<ArrowClockwise size={14} />}>
        Refresh
      </Button>
    );
    expect(htmlWithElement).toContain('Refresh');
    expect(htmlWithElement).toContain('data-variant="outline"');

    // Render with component constructor icon (defensive fallback)
    const htmlWithComponent = renderToString(
      <Button variant="outline" size="sm" icon={ArrowClockwise as unknown as React.ReactNode}>
        Refresh
      </Button>
    );
    expect(htmlWithComponent).toContain('Refresh');
  });

  it('should render Badge with both element and component icons without error', () => {
    const htmlWithElement = renderToString(
      <Badge variant="seal" icon={<Users className="w-3.5 h-3.5" />}>
        Active
      </Badge>
    );
    expect(htmlWithElement).toContain('Active');

    const htmlWithComponent = renderToString(
      <Badge variant="seal" icon={Users as unknown as React.ReactNode}>
        Active
      </Badge>
    );
    expect(htmlWithComponent).toContain('Active');
  });

  it('should render EventHeaderSummary without throwing React error #31', () => {
    const mockEvent: Event = {
      id: 'event-1',
      name: 'Workshop Web3 & Cloudflare',
      description: 'Diskusi arsitektur terdistribusi',
      location_name: 'Auditorium Utama',
      starts_at: '2025-06-01T09:00:00.000Z',
      ends_at: '2025-06-01T17:00:00.000Z',
      grace_minutes: 15,
      status: 'active',
      qr_policy: 'universal_allowed',
      session_modes: ['CHECKIN', 'CHECKOUT'],
      allow_manual_attendance: 1,
      created_at: '2025-05-01T00:00:00.000Z',
      updated_at: '2025-05-01T00:00:00.000Z',
    };

    const html = renderToString(
      <EventHeaderSummary
        event={mockEvent}
        onBack={() => {}}
        onRefresh={() => {}}
        onScanEvent={() => {}}
        onOpenManualAttendance={() => {}}
        onOpenPrintSheet={() => {}}
        onExportAttendance={() => {}}
        onDeleteEvent={() => {}}
        printableTokensCount={3}
        isManager={true}
        canExport={true}
      />
    );
    expect(html).toContain('Workshop Web3 &amp; Cloudflare');
    expect(html).toContain('Presensi Manual');
    expect(html).toContain('Cetak Tiket');
    expect(html).toContain('Ekspor CSV');
    expect(html).toContain('Hapus');
    expect(html).toContain('Buka Scanner');
  });

  it('should render AttendanceRosterTable (empty and filled) without throwing error', () => {
    const sessionCounts = {
      checkin: 0,
      checkout: 0,
      breakOut: 0,
      breakIn: 0,
    };

    // Empty state
    const emptyHtml = renderToString(
      <AttendanceRosterTable
        attendances={[]}
        displayedAttendances={[]}
        totalScanned={0}
        sessionCounts={sessionCounts}
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
    expect(emptyHtml).toContain('Belum Ada Presensi Tercatat');

    // Filled state
    const mockAttendance: Attendance = {
      id: 'att-1',
      event_id: 'event-1',
      member_id: 'mem-1',
      session_type: 'CHECKIN',
      qr_token_id: 'tok-1',
      scanned_at: '2025-06-01T09:05:00.000Z',
      station_id: null,
      operator_id: 'scanner-1',
      is_manual: 0,
      meta: '{}',
      member_name: 'Budi Santoso',
      member_external_id: 'MEM-001',
      member_division: 'Engineering',
    };

    const filledHtml = renderToString(
      <AttendanceRosterTable
        attendances={[mockAttendance]}
        displayedAttendances={[mockAttendance]}
        totalScanned={1}
        sessionCounts={{ ...sessionCounts, checkin: 1 }}
        sessionFilter="ALL"
        onSelectSessionFilter={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedDivision=""
        onDivisionChange={() => {}}
        divisions={['Engineering']}
        selectedAttendanceIds={new Set(['att-1'])}
        onToggleSelectAttendance={() => {}}
        onSelectAllAttendances={() => {}}
        onDeleteAttendanceBatch={() => {}}
        onOpenManualAttendance={() => {}}
        isManager={true}
      />
    );
    expect(filledHtml).toContain('Budi Santoso');
  });

  it('should render the roster as one index-card grammar, never a table', () => {
    const sessionCounts = { checkin: 1, checkout: 0, breakOut: 0, breakIn: 0 };
    const mockAttendance: Attendance = {
      id: 'att-1',
      event_id: 'event-1',
      member_id: 'mem-1',
      session_type: 'CHECKIN',
      qr_token_id: 'tok-1',
      scanned_at: '2025-06-01T09:05:00.000Z',
      station_id: null,
      operator_id: 'scanner-1',
      is_manual: 0,
      meta: '{}',
      member_name: 'Budi Santoso',
      member_external_id: 'MEM-001',
      member_division: 'Engineering',
    };

    const html = renderToString(
      <AttendanceRosterTable
        attendances={[mockAttendance]}
        displayedAttendances={[mockAttendance]}
        totalScanned={1}
        sessionCounts={sessionCounts}
        sessionFilter="ALL"
        onSelectSessionFilter={() => {}}
        search=""
        onSearchChange={() => {}}
        selectedDivision=""
        onDivisionChange={() => {}}
        divisions={['Engineering']}
        selectedAttendanceIds={new Set(['att-1'])}
        onToggleSelectAttendance={() => {}}
        onSelectAllAttendances={() => {}}
        onDeleteAttendanceBatch={() => {}}
        onOpenManualAttendance={() => {}}
        isManager={true}
      />
    );

    // A card/list toggle was the only reason a column table shipped here, and
    // a toggle that exists means two grammars for one list.
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Tampilan Kartu');
    expect(html).not.toContain('Tampilan Tabel');
    // The columns became the row's two lines — nothing was dropped.
    expect(html).toContain('Budi Santoso');
    expect(html).toContain('MEM-001');
    expect(html).toContain('data-mark="seal"');
  });

  it('should render GuestPassWorkspace (empty and populated) with valid EmptyState and Buttons', () => {
    const mockEvent: Event = {
      id: 'event-1',
      name: 'Workshop Web3',
      description: null,
      location_name: null,
      starts_at: null,
      ends_at: null,
      grace_minutes: 0,
      status: 'active',
      qr_policy: 'universal_allowed',
      session_modes: ['CHECKIN'],
      allow_manual_attendance: 1,
      created_at: '2025-05-01T00:00:00.000Z',
      updated_at: '2025-05-01T00:00:00.000Z',
    };

    // Empty state
    const emptyHtml = renderToString(
      <GuestPassWorkspace
        event={mockEvent}
        qrTokens={[]}
        selectedTokenIds={new Set()}
        onToggleSelectToken={() => {}}
        onSelectAllTokens={() => {}}
        onOpenGuestModal={() => {}}
        onOpenQrModal={() => {}}
        onOpenPrintSheet={() => {}}
        onSelectTokenForCard={() => {}}
        onOpenConvertCandidateSingle={() => {}}
        onOpenConvertCandidateBulk={() => {}}
        onRevokeToken={() => {}}
        onRevokeTokenBatch={() => {}}
        onDeleteToken={() => {}}
        onDeleteTokenBatch={() => {}}
        isManager={true}
        canGenerate={true}
      />
    );
    expect(emptyHtml).toContain('Belum Ada Tiket QR Khusus');
    expect(emptyHtml).toContain('Buat Tiket Tamu Sekarang');

    // Populated state
    const mockToken: QrToken = {
      id: 'tok-1',
      qr_token: 'jwt-token-string',
      jti: 'jti-1',
      member_id: 'guest-1',
      event_id: 'event-1',
      scope: 'event',
      valid_from: '2025-06-01T00:00:00.000Z',
      expires_at: '2025-06-02T00:00:00.000Z',
      revoked_at: null,
      max_uses: 1,
      uses_count: 0,
      note: null,
      created_by: 'admin-1',
      created_at: '2025-06-01T00:00:00.000Z',
      member_name: 'Tamu Kehormatan',
      member_external_id: 'GUEST-12345',
      member_division: 'External',
    };

    const populatedHtml = renderToString(
      <GuestPassWorkspace
        event={mockEvent}
        qrTokens={[mockToken]}
        selectedTokenIds={new Set()}
        onToggleSelectToken={() => {}}
        onSelectAllTokens={() => {}}
        onOpenGuestModal={() => {}}
        onOpenQrModal={() => {}}
        onOpenPrintSheet={() => {}}
        onSelectTokenForCard={() => {}}
        onOpenConvertCandidateSingle={() => {}}
        onOpenConvertCandidateBulk={() => {}}
        onRevokeToken={() => {}}
        onRevokeTokenBatch={() => {}}
        onDeleteToken={() => {}}
        onDeleteTokenBatch={() => {}}
        isManager={true}
        canGenerate={true}
      />
    );
    expect(populatedHtml).toContain('Tamu Kehormatan');
  });

  it('drops revoked, expired and payload-less tokens from the print sheet', () => {
    const printable = filterPrintableTokens(sampleTokens, 'Sample Event', undefined, NOW);

    expect(printable.map((t) => t.id)).toEqual(['tok-1', 'tok-2']);
  });

  it('never prints a revoked token even when the operator explicitly selects it', () => {
    // The dangerous case: an operator ticks a revoked row and hits print.
    const printable = filterPrintableTokens(sampleTokens, 'Sample Event', new Set(['tok-3']), NOW);

    expect(printable).toHaveLength(0);
  });

  it('honours an explicit selection over the full live set', () => {
    const printable = filterPrintableTokens(sampleTokens, 'Sample Event', new Set(['tok-1']), NOW);

    expect(printable).toHaveLength(1);
    expect(printable[0].member_name).toBe('Guest One');
  });

  it('treats an empty selection as "nothing selected", not "everything selected"', () => {
    const printable = filterPrintableTokens(sampleTokens, 'Sample Event', new Set(), NOW);

    expect(printable).toHaveLength(0);
  });

  it('stamps the event name and falls back for missing member identity fields', () => {
    const [first] = filterPrintableTokens(
      [{ ...sampleTokens[0], member_name: undefined, member_external_id: undefined, member_division: undefined }],
      'Sample Event',
      undefined,
      NOW
    );

    expect(first.event_name).toBe('Sample Event');
    expect(first.member_name).toBe('Peserta');
    expect(first.member_external_id).toBe('guest-1');
    expect(first.member_division).toBeNull();
  });

  it('leaves the event name null when printing tokens outside any event', () => {
    const [first] = filterPrintableTokens(sampleTokens, null, undefined, NOW);

    expect(first.event_name).toBeNull();
  });
});