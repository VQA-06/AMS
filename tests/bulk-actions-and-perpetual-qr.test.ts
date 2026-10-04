import { describe, it, expect } from 'vitest';
import { canDeleteAdmin } from '../src/server/routes/auth.routes';

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
