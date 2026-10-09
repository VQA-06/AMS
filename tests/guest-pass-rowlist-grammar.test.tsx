import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GuestPassWorkspace } from '../src/client/components/events/GuestPassWorkspace';
import { Event, QrToken } from '../src/shared/types';

/**
 * The guest QR pass list is one surface class with MemberList and EventList, so
 * it must speak the same grammar: an index-card row, not a seven-column table.
 *
 * Three things have to survive the conversion, and each is consumer-visible:
 * - No `<table>`: the whole point of the change. A table left in place with
 *   columns hidden at small widths would be two grammars for one list.
 * - `TAMU` still names a guest, since the tinted chip it replaced was the only
 *   thing saying so.
 * - The state word survives verbatim. `RowList` emits it as `data-mark`, and
 *   `color-semantics.test.tsx` reads that attribute to decide the mark hue — so
 *   a reworded status here silently repaints every revoked row.
 */
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

const baseToken = {
  qr_token: 'valid-jwt',
  jti: 'jti-abc',
  member_id: 'member-1',
  event_id: 'event-1',
  scope: 'event' as const,
  valid_from: '2025-06-01T00:00:00.000Z',
  expires_at: '',
  revoked_at: null,
  max_uses: 3,
  uses_count: 1,
  note: null,
  created_by: 'admin-1',
  created_at: '2025-06-01T00:00:00.000Z',
};

const tokens: QrToken[] = [
  {
    ...baseToken,
    id: 'tok-guest',
    member_name: 'Rian Pratama',
    member_external_id: 'GUEST-001',
    member_division: 'VIP',
  },
  {
    ...baseToken,
    id: 'tok-revoked',
    member_name: 'Sari Wijaya',
    member_external_id: 'GUEST-002',
    member_division: 'Media',
    revoked_at: '2025-06-01T12:00:00.000Z',
  },
  // No division, so the row exercises the 'Tamu Undangan' fallback rather
  // than asserting a word that only renders when a guest has none.
  {
    ...baseToken,
    id: 'tok-guest-bare',
    member_name: 'Budi Guest',
    member_external_id: 'GUEST-003',
    member_division: null,
  },
];

function renderWorkspace() {
  return renderToString(
    <GuestPassWorkspace
      event={mockEvent}
      qrTokens={tokens}
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
}

describe('Guest QR pass list uses the index-card RowList grammar', () => {
  it('renders no table and one row per token', () => {
    const html = renderWorkspace();

    expect(html).not.toContain('<table');
    expect(html).not.toContain('<thead');

    const marks = html.match(/data-mark=/g) ?? [];
    expect(marks).toHaveLength(tokens.length);
  });

  it('keeps the guest marker as the leading meta fragment', () => {
    const html = renderWorkspace();

    // Same word, same leading position: it now leads the meta string rather
    // than sitting in a bordered chip beside the name.
    expect(html).toContain('TAMU');
    expect(html).toContain('Tamu Undangan');
  });

  it('keeps the state word the mark hue is read against', () => {
    const html = renderWorkspace();

    expect(html).toContain('Dicabut');
    expect(html).toContain('Aktif');
    expect(html).toContain('data-mark="pen"');
    expect(html).toContain('data-mark="seal"');
  });
});
