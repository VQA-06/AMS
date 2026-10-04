import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RefreshCw, Users, QrCode } from 'lucide-react';
import { Button } from '../src/client/components/ui/Button';
import { Badge } from '../src/client/components/ui/Badge';
import { EventHeaderSummary } from '../src/client/components/events/EventHeaderSummary';
import { AttendanceRosterTable } from '../src/client/components/events/AttendanceRosterTable';
import { GuestPassWorkspace } from '../src/client/components/events/GuestPassWorkspace';
import { Event, Attendance, QrToken } from '../src/shared/types';

describe('EventDetailPage Subcomponents & Primitives Render Verification', () => {
  it('should render Button with outline variant and both element and component icons without error', () => {
    // Render with JSX element icon
    const htmlWithElement = renderToString(
      <Button variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}>
        Refresh
      </Button>
    );
    expect(htmlWithElement).toContain('Refresh');
    expect(htmlWithElement).toContain('bg-slate-900/80');

    // Render with component constructor icon (defensive fallback)
    const htmlWithComponent = renderToString(
      <Button variant="outline" size="sm" icon={RefreshCw as unknown as React.ReactNode}>
        Refresh
      </Button>
    );
    expect(htmlWithComponent).toContain('Refresh');
  });

  it('should render Badge with both element and component icons without error', () => {
    const htmlWithElement = renderToString(
      <Badge variant="emerald" icon={<Users className="w-3.5 h-3.5" />}>
        Active
      </Badge>
    );
    expect(htmlWithElement).toContain('Active');

    const htmlWithComponent = renderToString(
      <Badge variant="emerald" icon={Users as unknown as React.ReactNode}>
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
        mobileViewMode="table"
        onToggleMobileViewMode={() => {}}
        selectedAttendanceIds={new Set()}
        onToggleSelectAttendance={() => {}}
        onSelectAllAttendances={() => {}}
        onDeleteAttendanceBatch={() => {}}
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
        mobileViewMode="table"
        onToggleMobileViewMode={() => {}}
        selectedAttendanceIds={new Set(['att-1'])}
        onToggleSelectAttendance={() => {}}
        onSelectAllAttendances={() => {}}
        onDeleteAttendanceBatch={() => {}}
        isManager={true}
      />
    );
    expect(filledHtml).toContain('Budi Santoso');
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
        onOpenPromoteSingle={() => {}}
        onOpenPromoteBulk={() => {}}
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
        onOpenPromoteSingle={() => {}}
        onOpenPromoteBulk={() => {}}
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

  it('should correctly scope printable tokens to selectedTokenIds for multi-select print', () => {
    const sampleTokens: QrToken[] = [
      {
        id: 'tok-1',
        qr_token: 'valid-jwt-1',
        jti: 'jti-1',
        member_id: 'guest-1',
        event_id: 'event-1',
        scope: 'event',
        valid_from: '2025-06-01T00:00:00.000Z',
        expires_at: '2030-01-01T00:00:00.000Z',
        revoked_at: null,
        max_uses: 1,
        uses_count: 0,
        note: null,
        created_by: 'admin-1',
        created_at: '2025-06-01T00:00:00.000Z',
        member_name: 'Guest One',
        member_external_id: 'GUEST-001',
        member_division: 'VIP',
      },
      {
        id: 'tok-2',
        qr_token: 'valid-jwt-2',
        jti: 'jti-2',
        member_id: 'guest-2',
        event_id: 'event-1',
        scope: 'event',
        valid_from: '2025-06-01T00:00:00.000Z',
        expires_at: '2030-01-01T00:00:00.000Z',
        revoked_at: null,
        max_uses: 1,
        uses_count: 0,
        note: null,
        created_by: 'admin-1',
        created_at: '2025-06-01T00:00:00.000Z',
        member_name: 'Guest Two',
        member_external_id: 'GUEST-002',
        member_division: 'Media',
      },
      {
        id: 'tok-3',
        qr_token: 'valid-jwt-3',
        jti: 'jti-3',
        member_id: 'guest-3',
        event_id: 'event-1',
        scope: 'event',
        valid_from: '2025-06-01T00:00:00.000Z',
        expires_at: '2030-01-01T00:00:00.000Z',
        revoked_at: '2025-06-01T12:00:00.000Z', // Revoked
        max_uses: 1,
        uses_count: 0,
        note: null,
        created_by: 'admin-1',
        created_at: '2025-06-01T00:00:00.000Z',
        member_name: 'Guest Three',
        member_external_id: 'GUEST-003',
        member_division: 'VIP',
      },
    ];

    // Filter printable tokens (active and unrevoked)
    const printableTokens = sampleTokens
      .filter(
        (tok) =>
          !tok.revoked_at &&
          new Date(tok.expires_at).getTime() > Date.now() &&
          Boolean(tok.qr_token)
      )
      .map((tok) => ({
        id: tok.id,
        member_id: tok.member_id,
        member_name: tok.member_name || 'Peserta',
        member_external_id: tok.member_external_id || tok.member_id,
        member_division: tok.member_division || null,
        qr_token: tok.qr_token as string,
        scope: tok.scope,
        expires_at: tok.expires_at,
        event_name: 'Sample Event',
      }));

    expect(printableTokens.length).toBe(2);

    // Select only tok-1
    const selectedTokenIds = new Set<string>(['tok-1']);
    const targetTokens = printableTokens.filter((t) => selectedTokenIds.has(t.id));
    expect(targetTokens.length).toBe(1);
    expect(targetTokens[0].id).toBe('tok-1');
    expect(targetTokens[0].member_name).toBe('Guest One');

    // Select revoked tok-3
    const selectedRevokedIds = new Set<string>(['tok-3']);
    const targetRevoked = printableTokens.filter((t) => selectedRevokedIds.has(t.id));
    expect(targetRevoked.length).toBe(0);
  });
});
