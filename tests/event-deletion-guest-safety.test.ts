import { describe, it, expect } from 'vitest';
import { EventRepository } from '../src/server/repositories/event.repo';
import { QrTokenRepository } from '../src/server/repositories/qr.repo';

describe('Event Deletion & Cross-Event Guest Safety', () => {
  it('should NEVER delete guests belonging to other events when an event is deleted', async () => {
    // Simulated DB state:
    // Event 1 has Guest 1
    // Event 2 has Guest 2
    const deletedStatements: Array<{ sql: string; params: any[] }> = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          sql,
          params,
          all: async () => {
            // When querying members tied EXCLUSIVELY to event 1:
            // Guest 2 (from Event 2) must NOT be returned!
            const targetEventId = params[0];
            if (targetEventId === 'evt_1') {
              // Only Guest 1 is returned as exclusive to evt_1
              return { results: [{ id: 'mem_guest_1' }] };
            }
            return { results: [] };
          },
          run: async () => ({ success: true }),
        }),
      }),
      batch: async (statements: any[]) => {
        deletedStatements.push(...statements);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repo = new EventRepository(mockDb);
    const success = await repo.delete('evt_1');

    expect(success).toBe(true);

    // Verify that mem_guest_2 is never in any delete statement
    const allDeletedText = JSON.stringify(deletedStatements);
    expect(allDeletedText).not.toContain('mem_guest_2');
    expect(allDeletedText).toContain('evt_1');
    expect(allDeletedText).toContain('mem_guest_1');
  });

  it('should preserve imported guest in target event when source event is deleted', async () => {
    let selectExecutedSql = '';
    let selectExecutedParams: any[] = [];
    const batchStatements: any[] = [];

    // State:
    // Guest G1 was created in Event 1, then imported into Event 2
    // When Event 1 is deleted:
    // G1 has a link in event_guests WHERE event_id = 'evt_2' (event_id != 'evt_1')
    // Therefore, G1 MUST NOT be in guestIds to delete!
    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => {
          if (sql.includes('SELECT m.id FROM members m')) {
            selectExecutedSql = sql;
            selectExecutedParams = params;
            return {
              sql,
              params,
              all: async () => {
                // Since G1 is enrolled in evt_2, the SQL condition:
                // m.id NOT IN (SELECT member_id FROM event_guests WHERE event_id != 'evt_1')
                // filters G1 out. No exclusive guests exist to delete.
                return { results: [] };
              },
            };
          }
          return {
            sql,
            params,
            run: async () => ({ success: true }),
          };
        },
      }),
      batch: async (statements: any[]) => {
        batchStatements.push(...statements);
        return statements.map(() => ({ success: true }));
      },
    };

    const repo = new EventRepository(mockDb);
    const result = await repo.delete('evt_1');

    expect(result).toBe(true);
    // Assert the query contains the multi-event exclusion guards
    expect(selectExecutedSql).toContain('m.id NOT IN');
    expect(selectExecutedSql).toContain('SELECT member_id FROM event_guests WHERE event_id != ?');
    expect(selectExecutedSql).toContain('SELECT a.member_id FROM attendances a WHERE a.event_id != ?');
    expect(selectExecutedSql).toContain('SELECT t.member_id FROM qr_tokens t WHERE t.event_id != ?');

    // Assert that 'Tamu:%' is NOT passed as a filter parameter in the event selector
    expect(selectExecutedParams).not.toContain('Tamu:%');
    expect(selectExecutedSql).not.toContain('OR m.group_name LIKE ?');

    // Assert that qr_tokens for G1 are reassigned to evt_2 before deleting remaining tokens
    const updateTokenStmt = batchStatements.find((s) =>
      s.sql?.includes('UPDATE qr_tokens') && s.sql?.includes('SET event_id = (SELECT eg.event_id FROM event_guests')
    );
    expect(updateTokenStmt).toBeDefined();

    // Assert that members table is NOT called with DELETE since results was empty
    const deleteMembersStmt = batchStatements.find((s) => s.sql?.includes('DELETE FROM members WHERE id IN'));
    expect(deleteMembersStmt).toBeUndefined();
  });

  it('should safely delete orphaned guest when event has no cross-event imports', async () => {
    const batchStatements: any[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => {
          if (sql.includes('SELECT m.id FROM members m')) {
            return {
              sql,
              params,
              all: async () => ({
                results: [{ id: 'mem_orphan_guest' }],
              }),
            };
          }
          return {
            sql,
            params,
            run: async () => ({ success: true }),
          };
        },
      }),
      batch: async (statements: any[]) => {
        batchStatements.push(...statements);
        return statements.map(() => ({ success: true }));
      },
    };

    const repo = new EventRepository(mockDb);
    await repo.delete('evt_isolated');

    // When guest is purely isolated to evt_isolated, it should be deleted
    const deleteMembersStmt = batchStatements.find(
      (s) => s.sql?.includes('DELETE FROM members WHERE id IN') && s.params.includes('mem_orphan_guest')
    );
    expect(deleteMembersStmt).toBeDefined();
  });

  it('should chunk qr_tokens createBatch into slices of 50 statements for D1 safety', async () => {
    const batchSliceSizes: number[] = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({ sql, params }),
      }),
      batch: async (statements: any[]) => {
        batchSliceSizes.push(statements.length);
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const qrRepo = new QrTokenRepository(mockDb);
    const tokens = Array.from({ length: 110 }, (_, i) => ({
      id: `tok_${i + 1}`,
      jti: `jti_${i + 1}`,
      member_id: `mem_${i + 1}`,
      event_id: 'evt_bulk',
      scope: 'event' as const,
      valid_from: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }));

    await qrRepo.createBatch(tokens);

    expect(batchSliceSizes.length).toBe(3);
    expect(batchSliceSizes[0]).toBe(50);
    expect(batchSliceSizes[1]).toBe(50);
    expect(batchSliceSizes[2]).toBe(10);
  });
});
