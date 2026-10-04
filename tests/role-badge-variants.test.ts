import { describe, it, expect } from 'vitest';
import { getRoleInfo, canManageEvents, canScanQR, canExportData } from '@/client/lib/permissions';
import type { BadgeVariant } from '@/client/components/ui/Badge';
import type { Role } from '@/shared/types';

const ROLES: Role[] = ['owner', 'admin', 'operator', 'auditor'];

/**
 * The role badge must stay a palette token rather than a class string: the
 * Settings team table renders `<Badge variant={...}>`, so a raw class would
 * have silently stopped rendering. These lock that contract at the boundary.
 */
describe('getRoleInfo', () => {
  it('gives every role a distinct, non-empty label', () => {
    const labels = ROLES.map((r) => getRoleInfo(r).label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
  });

  it('maps each role to the intended palette variant', () => {
    expect(getRoleInfo('owner').variant).toBe('pen');
    expect(getRoleInfo('admin').variant).toBe('info');
    expect(getRoleInfo('operator').variant).toBe('seal');
    expect(getRoleInfo('auditor').variant).toBe('neutral');
  });

  it('never renders the warning hue for a role', () => {
    // `pending` means "pending/attention" everywhere else in the UI; a role
    // badge in that hue would read as a warning about the person.
    for (const role of ROLES) {
      expect(getRoleInfo(role).variant).not.toBe('pending');
    }
  });

  it('returns a real Badge variant for every role and for unknown input', () => {
    const valid: BadgeVariant[] = ['seal', 'pen', 'pending', 'danger', 'info', 'neutral'];
    for (const role of ROLES) {
      expect(valid).toContain(getRoleInfo(role).variant);
    }
    // An absent role must still produce a renderable badge, not undefined.
    expect(getRoleInfo(undefined).variant).toBe('neutral');
    expect(getRoleInfo(null).variant).toBe('neutral');
    expect(getRoleInfo('not-a-role' as Role).label).toBe('Panitia');
  });

  it('keeps the operator role above the auditor in capability', () => {
    expect(canScanQR('operator')).toBe(true);
    expect(canManageEvents('operator')).toBe(false);
    expect(canExportData('auditor')).toBe(true);
  });
});