import { describe, it, expect, vi } from 'vitest';
import { MutationCoordinator } from '../src/server/lib/mutation-coordinator';
import * as edgeCacheModule from '../src/server/lib/edge-cache';

describe('MutationCoordinator', () => {
  it('executes batch statements and automatically attaches audit log', async () => {
    const executedStatements: Array<{ sql: string; params: unknown[] }> = [];

    const mockDb = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          sql,
          params,
        }),
      }),
      batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
        for (const s of statements) {
          executedStatements.push(s);
        }
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    } as unknown as D1Database;

    const invalidateSpy = vi.spyOn(edgeCacheModule, 'invalidateEdgeCache').mockResolvedValue(undefined);

    const coordinator = new MutationCoordinator(mockDb, { executionCtx: {} });
    const dummyStmt = mockDb.prepare('UPDATE events SET status = ? WHERE id = ?').bind('closed', 'evt_1') as unknown as D1PreparedStatement;

    const result = await coordinator.execute({
      statements: [dummyStmt],
      cacheTags: ['agenda', 'attendance'],
      audit: {
        adminId: 'adm_admin_1',
        action: 'CLOSE_EVENT',
        entityType: 'event',
        entityId: 'evt_1',
        meta: { reason: 'Scheduled close' },
      },
      resultTransform: (res) => ({ totalChanged: res.length }),
    });

    expect(result).toEqual({ totalChanged: 2 });
    expect(executedStatements).toHaveLength(2);
    expect(executedStatements[0].sql).toContain('UPDATE events');
    expect(executedStatements[1].sql).toContain('INSERT INTO audit_logs');
    expect(executedStatements[1].params).toContain('CLOSE_EVENT');
    expect(executedStatements[1].params).toContain('adm_admin_1');

    expect(invalidateSpy).toHaveBeenCalledWith(['agenda', 'attendance'], expect.anything());
    invalidateSpy.mockRestore();
  });

  it('executes without audit or cacheTags if not specified', async () => {
    const executedStatements: Array<{ sql: string; params: unknown[] }> = [];

    const mockDb = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          sql,
          params,
        }),
      }),
      batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
        for (const s of statements) {
          executedStatements.push(s);
        }
        return [{ success: true }];
      },
    } as unknown as D1Database;

    const invalidateSpy = vi.spyOn(edgeCacheModule, 'invalidateEdgeCache').mockResolvedValue(undefined);

    const coordinator = new MutationCoordinator(mockDb);
    const dummyStmt = mockDb.prepare('DELETE FROM temp_table').bind() as unknown as D1PreparedStatement;

    await coordinator.execute({
      statements: [dummyStmt],
    });

    expect(executedStatements).toHaveLength(1);
    expect(executedStatements[0].sql).toContain('DELETE FROM temp_table');
    expect(invalidateSpy).not.toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });
});
