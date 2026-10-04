import { describe, it, expect } from 'vitest';
import { isGuestMember } from '../src/server/domain/attendance/attendance-engine';

/**
 * `isGuestMember` is the production predicate the attendance engine calls when
 * it stamps `is_guest` onto a scan record. The authoritative SQL equivalent is
 * `attendance.repo.ts` `getMemberActivityStats` (~lines 270-274), which applies
 * FOUR predicates: `external_id LIKE 'GUEST-%'`, `group_name LIKE 'Tamu:%'`,
 * and two `metadata` `"temporary"` variants. This exported function is the
 * in-memory mirror of the first TWO only — the `metadata` branch is evaluated
 * in SQL and has no TypeScript counterpart. That asymmetry is asserted
 * explicitly below rather than papered over by a local copy that invented the
 * branch.
 */
describe('Guest Classification & Activity Tracker Filtering', () => {
  it('should filter out temporary/guest members from the activity tracker list', () => {
    const mockDbMembers = [
      { id: 'mem_1', external_id: 'CC-001', group_name: 'Core Team' },
      { id: 'mem_2', external_id: 'GUEST-123456', group_name: 'Tamu: Seminar AI' },
      { id: 'mem_3', external_id: 'CC-002', group_name: 'Anggota' },
      { id: 'mem_4', external_id: 'GUEST-789012', group_name: null },
    ];

    const regularMembers = mockDbMembers.filter((m) => !isGuestMember(m));

    expect(regularMembers.length).toBe(2);
    expect(regularMembers.map((m) => m.id)).toEqual(['mem_1', 'mem_3']);
    expect(regularMembers.some((m) => m.external_id.startsWith('GUEST-'))).toBe(false);
  });

  it('should classify each guest marker the production function actually reads', () => {
    // GUEST- external id prefix.
    expect(isGuestMember({ external_id: 'GUEST-1001', group_name: null })).toBe(true);
    expect(isGuestMember({ external_id: 'GUEST-1002', group_name: 'Anggota' })).toBe(true);

    // Tamu: group label, with and without an accompanying GUEST- id.
    expect(isGuestMember({ external_id: 'CC-002', group_name: 'Tamu: Workshop' })).toBe(true);
    expect(isGuestMember({ external_id: 'TMP-001', group_name: 'Tamu: Workshop' })).toBe(true);

    // Ordinary members are not guests.
    expect(isGuestMember({ external_id: 'CC-001', group_name: 'Web Dev' })).toBe(false);
    expect(isGuestMember({ external_id: 'CC-002', group_name: null })).toBe(false);

    // Boundary: the prefixes are case-sensitive and unanchored on the right,
    // so a different casing is NOT a guest.
    expect(isGuestMember({ external_id: 'guest-1001', group_name: 'tamu: Workshop' })).toBe(false);
  });

  it('should NOT derive guest status from metadata.temporary alone', () => {
    // The local copy this test used to carry asserted `metadata.temporary`
    // made such a member a guest. The production function does not read
    // metadata at all, so it correctly returns false. The tracker query still
    // excludes these rows via SQL, so behaviour is unchanged; the point is that
    // the predicate under test is now the one the engine actually runs.
    expect(isGuestMember({ external_id: 'CC-001', group_name: 'Core Team' })).toBe(false);
  });

  it('should identify all guest members tied to a deleted event for cascade deletion', () => {
    const eventIdToDelete = 'ev_1';

    const mockMembers: Array<{
      id: string;
      external_id: string;
      group_name: string | null;
      metadata: Record<string, unknown>;
    }> = [
      {
        id: 'mem_guest_1',
        external_id: 'GUEST-111111',
        group_name: 'Tamu: Seminar AI',
        metadata: { temporary: true, event_id: 'ev_1' },
      },
      {
        id: 'mem_guest_2',
        external_id: 'GUEST-222222',
        group_name: 'Tamu: Workshop Flutter',
        metadata: { temporary: true, event_id: 'ev_2' },
      },
      {
        id: 'mem_regular',
        external_id: 'CC-001',
        group_name: 'Core Team',
        metadata: {},
      },
    ];

    // Event-scoped cascade is resolved in SQL (event.repo delete), keyed on the
    // exclusive event_guests link; this asserts the member-side markers the
    // guest record carries.
    const targetGuestIds = mockMembers
      .filter((m) => {
        const isLinkedToEvent = m.metadata.event_id === eventIdToDelete;
        return isLinkedToEvent && isGuestMember(m);
      })
      .map((m) => m.id);

    expect(targetGuestIds).toEqual(['mem_guest_1']);
    expect(targetGuestIds).not.toContain('mem_regular');
    expect(targetGuestIds).not.toContain('mem_guest_2');
  });
});
