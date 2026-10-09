import { describe, it, expect } from 'vitest';
import app from '../src/server/index';
import { createSessionToken } from '../src/server/crypto/session-crypto';
import { canDeleteAdmin } from '../src/server/routes/auth.routes';
import { chunkArray, D1_MAX_SAFE_PARAM_CHUNK } from '../src/server/lib/d1-utils';
import { EventRepository } from '../src/server/repositories/event.repo';

/**
 * These assertions target `canDeleteAdmin`, the exact predicate the
 * `POST /api/auth/admins/bulk-delete` loop calls for every id. Before this port
 * the suite restated the rule in a local filter closure, so the rule that
 * protects the default master owner was never exercised at its enforcement
 * point — which is how `TeamTab.tsx` shipped a bulk delete that POSTed the
 * literal id `"bulk"` while the suite stayed green.
 */
describe('Admin Bulk Delete Protection', () => {
  it('should protect current user and default master owner from bulk deletion', () => {
    const CURRENT = 'adm_cur';

    const owner = { id: 'adm_owner', role: 'owner', member_id: null };
    const currentOwner = { id: 'adm_cur', role: 'owner', member_id: 'mem_1' };
    const operator = { id: 'adm_op', role: 'operator', member_id: 'mem_2' };
    const auditor = { id: 'adm_aud', role: 'auditor', member_id: null };
    const admin = { id: 'adm_admin', role: 'admin', member_id: 'mem_3' };

    // Self-protection: an owner may not delete their own account, even though
    // they carry a member_id and so escape the default-master rule below.
    expect(canDeleteAdmin(CURRENT, currentOwner)).toBe(false);
    // Default master owner: role owner with no linked member.
    expect(canDeleteAdmin(CURRENT, owner)).toBe(false);

    // Ordinary accounts are deletable.
    expect(canDeleteAdmin(CURRENT, operator)).toBe(true);
    expect(canDeleteAdmin(CURRENT, admin)).toBe(true);

    // The default-master rule is scoped to role === 'owner'. A member-less
    // auditor is not protected, proving the guard does not block every account
    // that happens to have a null member_id.
    expect(canDeleteAdmin(CURRENT, auditor)).toBe(true);
  });

  it('should let one owner delete a different owner that has a linked member', () => {
    const current = { id: 'adm_cur', role: 'owner', member_id: 'mem_1' };
    const otherLinkedOwner = { id: 'adm_other', role: 'owner', member_id: 'mem_9' };
    const otherMasterOwner = { id: 'adm_master', role: 'owner', member_id: null };

    expect(canDeleteAdmin(current.id, otherLinkedOwner)).toBe(true);
    expect(canDeleteAdmin(current.id, otherMasterOwner)).toBe(false);
  });
});

describe('D1 Safe Parameter Chunking for Multi-Select Bulk Actions', () => {
  it('should chunk large item selections (e.g. 262 items) into safe sub-100 parameter chunks', () => {
    const items = Array.from({ length: 262 }, (_, i) => `item_${i + 1}`);
    const chunks = chunkArray(items, D1_MAX_SAFE_PARAM_CHUNK);

    expect(chunks.length).toBe(6); // 50 * 5 + 12 = 262
    expect(chunks[0].length).toBe(50);
    expect(chunks[5].length).toBe(12);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(D1_MAX_SAFE_PARAM_CHUNK);
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  it('should chunk large guest deletion cascades safely in EventRepository.delete', async () => {
    const largeGuestIds = Array.from({ length: 150 }, (_, i) => ({ id: `guest_${i + 1}` }));
    const executedStatements: Array<{ sql: string; params: any[] }> = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => {
          if (sql.includes('SELECT m.id FROM members m')) {
            return {
              sql,
              params,
              all: async () => ({ results: largeGuestIds }),
            };
          }
          return { sql, params };
        },
      }),
      batch: async (stmts: any[]) => {
        executedStatements.push(...stmts);
        return [];
      },
    };

    const repo = new EventRepository(mockDb);
    const success = await repo.delete('evt_bulk_test');

    expect(success).toBe(true);

    // Verify all statement bound parameters stay within D1 limit
    for (const stmt of executedStatements) {
      expect(stmt.params.length).toBeLessThanOrEqual(50);
    }

    // Verify DELETE FROM members was chunked into 3 batches (50 + 50 + 50 = 150)
    const memberDeleteStmts = executedStatements.filter((s) => s.sql?.includes('DELETE FROM members WHERE id IN'));
    expect(memberDeleteStmts.length).toBe(3);
    expect(memberDeleteStmts[0].params.length).toBe(50);
    expect(memberDeleteStmts[1].params.length).toBe(50);
    expect(memberDeleteStmts[2].params.length).toBe(50);
  });

  it('should unlink admins (UPDATE admins SET member_id = NULL) and NOT delete admins during POST /api/members/bulk-delete', async () => {
    const token = await createSessionToken(
      { email: 'owner@ams.local', role: 'owner' },
      'super-secure-session-secret-key-32b!'
    );

    const executedStatements: Array<{ sql: string; params: any[] }> = [];
    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => {
          if (sql.includes('FROM admins')) {
            return {
              first: async () => ({ id: 'adm_owner', email: 'owner@ams.local', role: 'owner', status: 'active', member_id: null }),
              all: async () => ({ results: [] }),
              run: async () => ({ meta: { changes: 1 } }),
            };
          }
          return { sql, params, run: async () => ({ meta: { changes: 1 } }) };
        },
      }),
      batch: async (stmts: any[]) => {
        executedStatements.push(...stmts);
        return stmts.map(() => ({ meta: { changes: 1 } }));
      },
    };

    const res = await app.request(
      '/api/members/bulk-delete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: ['mem_1', 'mem_2'] }),
      },
      {
        DB: mockDb,
        SESSION_SECRET: 'super-secure-session-secret-key-32b!',
      }
    );

    expect(res.status).toBe(200);
    const json = await res.json<{ ok: boolean; data: { count: number } }>();
    expect(json.ok).toBe(true);
    expect(json.data.count).toBe(2);

    // Assert: NEVER executes DELETE FROM admins
    const deleteAdminStmts = executedStatements.filter((s) => s.sql?.includes('DELETE FROM admins'));
    expect(deleteAdminStmts.length).toBe(0);

    // Assert: Executes UPDATE admins SET member_id = NULL
    const updateAdminStmts = executedStatements.filter((s) =>
      s.sql?.includes('UPDATE admins SET member_id = NULL WHERE member_id IN')
    );
    expect(updateAdminStmts.length).toBe(1);
    expect(updateAdminStmts[0].params).toEqual(['mem_1', 'mem_2']);

    // Assert: Members table is deleted
    const deleteMemberStmts = executedStatements.filter((s) =>
      s.sql?.includes('DELETE FROM members WHERE id IN')
    );
    expect(deleteMemberStmts.length).toBe(1);
    expect(deleteMemberStmts[0].params).toEqual(['mem_1', 'mem_2']);
  });
});
/**
 * NOTE: the perpetual-QR `year >= 2090` heuristic lived only as a local copy
 * here. `isPerpetual` is component-local in `DigitalPassCard.tsx` and the server
 * side hardcodes `defaultExp = '2099-12-31T23:59:59.999Z'`
 * (`src/server/routes/members.routes.ts`). A test pinning the copy proved
 * nothing about either, so it was removed rather than kept as false coverage.
 *
 * NOTE: the multi-select `Set` test for `useSelection` (`SelectionBar.tsx`)
 * was removed here. It exercised `Set` semantics, not production code, and
 * `useSelection` is a React hook that needs a DOM renderer — unavailable under
 * the no-new-dependencies constraint. That test belongs with the hook, in a
 * DOM-enabled suite, not here.
 */
