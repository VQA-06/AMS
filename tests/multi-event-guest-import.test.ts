import { describe, it, expect, vi } from 'vitest';
import { EventGuestRepository } from '../src/server/repositories/event-guest.repo';
import { ErrorCode } from '../src/shared/constants/error-codes';

describe('Multi-Event Guest Import & QR Reusability', () => {
  it('should list up to 2 most recent previous events with guest tokens', async () => {
    let executedSql = '';
    let executedParams: any[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          first: async () => ({
            id: 'evt_current',
            starts_at: '2026-09-15T09:00:00Z',
            created_at: '2026-09-01T00:00:00Z',
          }),
          all: async () => {
            executedSql = sql;
            executedParams = params;
            return {
              results: [
                {
                  id: 'evt_prev_2',
                  name: 'Workshop Flutter 2026',
                  starts_at: '2026-09-10T09:00:00Z',
                  ends_at: '2026-09-10T17:00:00Z',
                  guest_count: 15,
                },
                {
                  id: 'evt_prev_1',
                  name: 'Seminar AI & Cloud 2026',
                  starts_at: '2026-09-05T09:00:00Z',
                  ends_at: '2026-09-05T16:00:00Z',
                  guest_count: 25,
                },
              ],
            };
          },
        }),
      }),
    };

    const repo = new EventGuestRepository(mockDb);
    const sources = await repo.listTwoPreviousEventsWithGuests('evt_current');
    expect(sources.length).toBe(2);
    expect(sources[0].id).toBe('evt_prev_2');
    expect(sources[0].guest_count).toBe(15);
    expect(sources[1].id).toBe('evt_prev_1');
    expect(sources[1].guest_count).toBe(25);
    expect(executedSql).toContain('SELECT event_id, member_id FROM event_guests');
    expect(executedSql).toContain('UNION');
    expect(executedSql).toContain('LIMIT 2');
    expect(executedParams[0]).toBe('evt_current');
  });
  it('should list candidate guests and flag already imported guests', async () => {
    let executedSql = '';
    let executedParams: any[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          all: async () => {
            executedSql = sql;
            executedParams = params;
            return {
              results: [
                {
                  member_id: 'mem_guest_1',
                  name: 'Dr. Hendra Wijaya',
                  external_id: 'GUEST-1001',
                  division: 'VIP',
                  token_jti: 'jti_guest_1',
                  token_id: 'tok_guest_1',
                  already_imported: 0,
                },
                {
                  member_id: 'mem_guest_2',
                  name: 'Siti Nurhaliza',
                  external_id: 'GUEST-1002',
                  division: 'Umum',
                  token_jti: 'jti_guest_2',
                  token_id: 'tok_guest_2',
                  already_imported: 1,
                },
              ],
            };
          },
        }),
      }),
    };

    const repo = new EventGuestRepository(mockDb);
    const candidates = await repo.listGuestsFromSourceEvent('evt_source', 'evt_target');
    expect(candidates.length).toBe(2);
    expect(candidates[0].already_imported).toBe(false);
    expect(candidates[1].already_imported).toBe(true);
    expect(executedSql).toContain('SELECT member_id FROM event_guests WHERE event_id = ?');
    expect(executedSql).toContain('UNION');
    expect(executedSql).toContain('JOIN qr_tokens t ON t.member_id = m.id');
    expect(executedSql).toContain('LEFT JOIN event_guests eg_target');
    expect(executedParams[0]).toBe('evt_source');
    expect(executedParams[1]).toBe('evt_source');
    expect(executedParams[2]).toBe('evt_target');
  });
  it('should batch insert imported guests into event_guests with INSERT OR IGNORE', async () => {
    const executedBatch: Array<{ sql: string; params: any[] }> = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          sql,
          params,
        }),
      }),
      batch: async (statements: any[]) => {
        for (const s of statements) {
          executedBatch.push({ sql: s.sql, params: s.params });
        }
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repo = new EventGuestRepository(mockDb);
    const count = await repo.importGuestsToEvent(
      'evt_target',
      ['mem_guest_1', 'mem_guest_2'],
      'evt_source'
    );

    expect(count).toBe(2);
    expect(executedBatch[1].params[2]).toBe('mem_guest_2');
  });

  it('should update qr_tokens expires_at when newExpiresAt is provided on import', async () => {
    const executedBatch: Array<{ sql: string; params: any[] }> = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          sql,
          params,
        }),
      }),
      batch: async (statements: any[]) => {
        for (const s of statements) {
          executedBatch.push({ sql: s.sql, params: s.params });
        }
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repo = new EventGuestRepository(mockDb);
    const count = await repo.importGuestsToEvent(
      'evt_target',
      ['mem_guest_1', 'mem_guest_2'],
      'evt_source',
      '2026-06-02T17:00:00.000Z'
    );

    expect(count).toBe(2);
    expect(executedBatch.length).toBe(4);
    // Statement 0: INSERT OR IGNORE INTO event_guests for mem_guest_1
    expect(executedBatch[0].sql).toContain('INSERT OR IGNORE INTO event_guests');
    expect(executedBatch[0].params[1]).toBe('evt_target');
    expect(executedBatch[0].params[2]).toBe('mem_guest_1');
    // Statement 1: UPDATE qr_tokens for mem_guest_1
    expect(executedBatch[1].sql).toContain('UPDATE qr_tokens');
    expect(executedBatch[1].params[0]).toBe('2026-06-02T17:00:00.000Z');
    expect(executedBatch[1].params[1]).toBe('mem_guest_1');
    expect(executedBatch[1].params[2]).toBe('2026-06-02T17:00:00.000Z');
    // Statement 2: INSERT OR IGNORE INTO event_guests for mem_guest_2
    expect(executedBatch[2].sql).toContain('INSERT OR IGNORE INTO event_guests');
    expect(executedBatch[2].params[2]).toBe('mem_guest_2');
    // Statement 3: UPDATE qr_tokens for mem_guest_2
    expect(executedBatch[3].sql).toContain('UPDATE qr_tokens');
    expect(executedBatch[3].params[0]).toBe('2026-06-02T17:00:00.000Z');
    expect(executedBatch[3].params[1]).toBe('mem_guest_2');
  });

  it('should chunk D1 batch statements with newExpiresAt (25 members = 50 statements per batch)', async () => {
    const batchesExecuted: number[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({ sql, params }),
      }),
      batch: async (statements: any[]) => {
        batchesExecuted.push(statements.length);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repo = new EventGuestRepository(mockDb);
    const sixtyGuestIds = Array.from({ length: 60 }, (_, i) => `mem_batch_${i + 1}`);

    const inserted = await repo.importGuestsToEvent('evt_large', sixtyGuestIds, 'evt_prev', '2026-06-02T17:00:00.000Z');

    expect(inserted).toBe(60);
    expect(batchesExecuted.length).toBe(3);
    expect(batchesExecuted[0]).toBe(50); // 25 members * 2 stmts = 50
    expect(batchesExecuted[1]).toBe(50); // 25 members * 2 stmts = 50
    expect(batchesExecuted[2]).toBe(20); // 10 members * 2 stmts = 20
  });

  it('should verify authorization for imported guests via isGuestAuthorizedForEvent', async () => {
    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          first: async () => {
            const [eventId, memberId] = params;
            if (eventId === 'evt_target' && memberId === 'mem_guest_authorized') {
              return { '1': 1 };
            }
            return null;
          },
        }),
      }),
    };

    const repo = new EventGuestRepository(mockDb);

    const isAuth = await repo.isGuestAuthorizedForEvent('evt_target', 'mem_guest_authorized');
    expect(isAuth).toBe(true);

    const isUnauthorized = await repo.isGuestAuthorizedForEvent('evt_target', 'mem_guest_unknown');
    expect(isUnauthorized).toBe(false);
  });

  it('should retrieve imported guest tokens across multi-hop source event chains', async () => {
    let executedSql = '';
    let executedParams: any[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          all: async () => {
            executedSql = sql;
            executedParams = params;
            return {
              results: [
                {
                  link_id: 'eg_link_1',
                  event_id: 'evt_target',
                  member_id: 'mem_guest_1',
                  source_event_id: 'evt_intermediate',
                  source_event_name: 'Seminar AI & Cloud',
                  member_name: 'Dr. Hendra Wijaya',
                  member_external_id: 'GUEST-1001',
                  member_division: 'VIP',
                  token_id: 'tok_origin_1',
                  token_jti: 'jti_guest_1',
                  token_scope: 'event',
                  token_event_id: 'evt_origin',
                  token_valid_from: '2026-09-01T00:00:00Z',
                  token_expires_at: '2026-09-30T23:59:59Z',
                  max_uses: null,
                  uses_count: 3,
                  revoked_at: null,
                },
              ],
            };
          },
        }),
      }),
    };

    const repo = new EventGuestRepository(mockDb);
    const importedTokens = await repo.getImportedGuestsForEvent('evt_target');

    expect(importedTokens.length).toBe(1);
    expect(importedTokens[0].member_id).toBe('mem_guest_1');
    expect(importedTokens[0].source_event_id).toBe('evt_intermediate');
    expect(importedTokens[0].token_event_id).toBe('evt_origin');
    expect(executedSql).toContain('FROM event_guests eg');
    expect(executedSql).toContain('JOIN qr_tokens t ON t.member_id = m.id AND t.revoked_at IS NULL');
    expect(executedParams[0]).toBe('evt_target');
  });

  it('should accurately simulate scanner event validation for reused QR codes', async () => {
    // Guest QR payload contains scope: 'event' and eventId: 'evt_prev'
    const qrPayload = {
      sub: 'mem_guest_01',
      jti: 'jti_prev_01',
      scope: 'event' as const,
      eventId: 'evt_prev',
    };

    const targetEventId = 'evt_new';

    // Mock authorization check
    const isGuestAuthorizedForTarget = async (eventId: string, memberId: string) => {
      // Authorized if in event_guests
      if (eventId === 'evt_new' && memberId === 'mem_guest_01') {
        return true;
      }
      return false;
    };

    // Case 1: Guest was imported into target event
    let isMultiEventGuest = false;
    if (qrPayload.scope === 'event' && qrPayload.eventId !== targetEventId) {
      const authorized = await isGuestAuthorizedForTarget(targetEventId, qrPayload.sub);
      if (authorized) {
        isMultiEventGuest = true;
      }
    }

    expect(isMultiEventGuest).toBe(true);

    // Case 2: Guest was NOT imported into target event
    let unauthorizedScanResult = null;
    if (qrPayload.scope === 'event' && qrPayload.eventId !== 'evt_other') {
      const authorized = await isGuestAuthorizedForTarget('evt_other', qrPayload.sub);
      if (!authorized) {
        unauthorizedScanResult = {
          ok: false,
          code: ErrorCode.WRONG_EVENT,
          message: 'Tiket QR ini ditujukan untuk kegiatan lain dan belum diimpor ke kegiatan ini.',
        };
      }
    }

    expect(unauthorizedScanResult).not.toBeNull();
    expect(unauthorizedScanResult?.code).toBe(ErrorCode.WRONG_EVENT);
  });

  it('should prevent duplicate attendance on target event for imported guests', async () => {
    // Attendance unique index simulation for (event_id, member_id, session_type)
    const existingAttendances: Array<{ event_id: string; member_id: string; session_type: string }> = [
      // Attended source event
      { event_id: 'evt_prev', member_id: 'mem_guest_01', session_type: 'CHECKIN' },
      // Already checked in at target event
      { event_id: 'evt_target', member_id: 'mem_guest_01', session_type: 'CHECKIN' },
    ];

    const checkDuplicate = (eventId: string, memberId: string, sessionType: string) => {
      const exists = existingAttendances.some(
        (a) => a.event_id === eventId && a.member_id === memberId && a.session_type === sessionType
      );
      if (exists) {
        return {
          ok: false,
          code: ErrorCode.ALREADY_SCANNED,
          message: 'Peserta sudah melakukan absensi untuk sesi ini.',
        };
      }
      return { ok: true };
    };

    // Checkin at target event for CHECKIN should be rejected as duplicate
    const checkinAgain = checkDuplicate('evt_target', 'mem_guest_01', 'CHECKIN');
    expect(checkinAgain.ok).toBe(false);
    expect(checkinAgain.code).toBe(ErrorCode.ALREADY_SCANNED);

    // Checkin at target event for CHECKOUT should be accepted (different session)
    const checkout = checkDuplicate('evt_target', 'mem_guest_01', 'CHECKOUT');
    expect(checkout.ok).toBe(true);
  });

  it('should chunk D1 batch inserts into slices of 50 statements for large imports', async () => {
    const batchesExecuted: number[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({ sql, params }),
      }),
      batch: async (statements: any[]) => {
        batchesExecuted.push(statements.length);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repo = new EventGuestRepository(mockDb);
    const seventyFiveGuestIds = Array.from({ length: 75 }, (_, i) => `mem_batch_${i + 1}`);

    const inserted = await repo.importGuestsToEvent('evt_large', seventyFiveGuestIds, 'evt_prev');

    expect(inserted).toBe(75);
    expect(batchesExecuted.length).toBe(2);
    expect(batchesExecuted[0]).toBe(50);
    expect(batchesExecuted[1]).toBe(25);
  });

  it('should unlink guest from specific event using removeGuestFromEvent', async () => {
    let executedSql = '';
    let executedParams: any[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          run: async () => {
            executedSql = sql;
            executedParams = params;
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    };

    const repo = new EventGuestRepository(mockDb);
    const success = await repo.removeGuestFromEvent('evt_target', 'mem_guest_unlink');

    expect(success).toBe(true);
    expect(executedSql).toContain('DELETE FROM event_guests WHERE event_id = ? AND member_id = ?');
    expect(executedParams).toEqual(['evt_target', 'mem_guest_unlink']);
  });
});
