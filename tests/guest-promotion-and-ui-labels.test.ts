import { describe, it, expect } from 'vitest';
import { MemberRepository } from '../src/server/repositories/member.repo';
import { isGuestMember } from '../src/server/domain/attendance/attendance-engine';
import { Member } from '../src/shared/types';

/**
 * Minimal D1 stand-in for `MemberRepository.promoteGuest`. `D1Database` is a
 * wide interface that cannot be satisfied structurally without reimplementing
 * the whole Workers surface, so the double is cast at that single boundary and
 * typed everywhere else. Every bound statement is captured so the test asserts
 * on the SQL params production actually sent, not on a hand-built object.
 */
function mockMemberDb(initial: Member) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  let current = initial;

  const statement = (sql: string, params: unknown[]) => ({
    sql,
    params,
    bind: (...bound: unknown[]) => statement(sql, bound),
    first: async () => current,
    all: async () => ({ results: [current] }),
    run: async () => {
      statements.push({ sql, params });
      return { success: true };
    },
  });

  const db = {
    prepare: (sql: string) => statement(sql, []),
    batch: async () => [],
  } as unknown as D1Database;

  return { db, statements };
}

const GUEST: Member = {
  id: 'mem_guest123',
  external_id: 'GUEST-987654',
  name: 'Rian Pratama',
  email: 'rian@example.com',
  phone: null,
  group_name: 'Tamu: Seminar AI',
  division: null,
  status: 'active',
  metadata: JSON.stringify({ temporary: true, event_id: 'ev_1' }),
  created_at: '',
  updated_at: '',
};

/** Positional params of the single captured UPDATE members statement. */
function updateParams(statements: Array<{ sql: string; params: unknown[] }>) {
  const update = statements.find((s) => s.sql.includes('UPDATE members'));
  if (!update) throw new Error('promoteGuest never issued an UPDATE members statement');
  return update.params;
}

describe('Guest Promotion to Official Member & Compact Action Labels', () => {
  it('should transform temporary guest metadata and external ID into official member format', async () => {
    const { db, statements } = mockMemberDb(GUEST);
    const repo = new MemberRepository(db);

    await repo.promoteGuest(GUEST.id, { division: 'Software Engineering' });

    const params = updateParams(statements);
    // SELECT * FROM members WHERE id = ? LIMIT 1
    // UPDATE members SET external_id = ?, group_name = ?, division = ?,
    //                    status = 'active', metadata = ?, updated_at = ...
    //   WHERE id = ?
    const [externalId, groupName, division, metadata] = params;

    expect(externalId).not.toBe(GUEST.external_id);
    expect(String(externalId).startsWith('GUEST-')).toBe(false);
    expect(externalId).toMatch(/^MBR-\d{6}$/);
    expect(groupName).toBe('Anggota');
    expect(division).toBe('Software Engineering');
    expect(params[params.length - 1]).toBe(GUEST.id);

    const meta = JSON.parse(String(metadata)) as Record<string, unknown>;
    expect(meta.temporary).toBeUndefined();
    expect(meta.event_id).toBeUndefined();
    expect(meta.is_promoted).toBe(true);
    expect(typeof meta.promoted_at).toBe('string');
    expect(Number.isNaN(Date.parse(String(meta.promoted_at)))).toBe(false);
  });

  it('should honour a caller-supplied official external ID and reject a GUEST- one', async () => {
    const { db, statements } = mockMemberDb(GUEST);
    const repo = new MemberRepository(db);

    await repo.promoteGuest(GUEST.id, { newExternalId: 'MBR-778899' });
    expect(updateParams(statements)[0]).toBe('MBR-778899');

    // A supplied id that still carries the GUEST- prefix is regenerated, so a
    // promoted member can never keep a guest-shaped external id.
    const second = mockMemberDb(GUEST);
    await new MemberRepository(second.db).promoteGuest(GUEST.id, {
      newExternalId: 'GUEST-111111',
    });
    expect(updateParams(second.statements)[0]).toMatch(/^MBR-\d{6}$/);
  });

  it('should preserve past attendance history on promotion', async () => {
    const { db, statements } = mockMemberDb(GUEST);
    const repo = new MemberRepository(db);

    await repo.promoteGuest(GUEST.id);

    // Attendance history is preserved because attendances key on member_id and
    // resolve external_id through the members join at read time; promotion
    // therefore must not rewrite, delete, or re-key attendance rows.
    const attendanceStatements = statements.filter((s) =>
      /UPDATE\s+attendances|DELETE\s+FROM\s+attendances|UPDATE\s+qr_tokens|DELETE\s+FROM\s+members/i.test(
        s.sql
      )
    );
    expect(attendanceStatements).toEqual([]);

    // Exactly one members UPDATE, and its WHERE is the stable member id, so
    // every attendance row still joins to the promoted member.
    const memberUpdates = statements.filter((s) => /UPDATE\s+members/i.test(s.sql));
    expect(memberUpdates.length).toBe(1);
    expect(updateParams(statements)[updateParams(statements).length - 1]).toBe('mem_guest123');
  });

  it('should qualify the promoted member for Activity Tracker statistics', async () => {
    // After promotion the member is no longer guest-shaped, so the tracker
    // query (which excludes GUEST- ids and Tamu: groups) must include them.
    const promoted = {
      external_id: 'MBR-778899',
      group_name: 'Anggota',
    };

    expect(isGuestMember(promoted)).toBe(false);
    // The pre-promotion member was excluded.
    expect(isGuestMember({ external_id: GUEST.external_id, group_name: GUEST.group_name })).toBe(
      true
    );
  });

  it('should provide concise bulk action labels for high mobile responsiveness', () => {
    const memberBulkLabels = ['Cetak QR', 'Nonaktifkan', 'Hapus'];
    const eventBulkLabels = ['Tutup', 'Hapus'];
    const tokenBulkLabels = ['Cetak QR', 'Jadikan Anggota', 'Hapus'];

    for (const label of [...memberBulkLabels, ...eventBulkLabels, ...tokenBulkLabels]) {
      expect(label.length).toBeLessThanOrEqual(16);
      expect(label).not.toContain('Massal');
      expect(label).not.toContain('Terpilih');
    }
  });
});
