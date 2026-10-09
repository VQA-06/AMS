import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Admin } from '../src/shared/types';

vi.mock('../src/client/lib/api-client', () => ({
  fetchApi: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../src/client/components/ui/ModalPortal', () => ({
  ModalPortal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal-portal">{children}</div>,
}));

import { TeamTab } from '../src/client/pages/settings/TeamTab';

const makeAdmin = (overrides: Partial<Admin> & Pick<Admin, 'id' | 'name' | 'role' | 'status'>): Admin => ({
  member_id: null,
  email: `${overrides.id}@ams.example`,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/** The signed-in owner. A second owner linked to a member is a normal row;
 *  only `adm_owner_default` is permanently locked. */
const signedInOwner = makeAdmin({
  id: 'adm_owner_1',
  name: 'Super Admin',
  role: 'owner',
  status: 'active',
  member_id: 'mem-1',
});

const defaultMaster = makeAdmin({
  id: 'adm_owner_default',
  name: 'Admin Utama',
  role: 'owner',
  status: 'active',
});

const activeOperator = makeAdmin({
  id: 'adm_operator_1',
  name: 'Budi Petugas',
  role: 'operator',
  status: 'active',
  member_id: 'mem-2',
  member_division: 'Engineering',
});

const suspendedOperator = makeAdmin({
  id: 'adm_operator_2',
  name: 'Rina Operator',
  role: 'operator',
  status: 'inactive',
  member_id: 'mem-3',
});

const admins = [defaultMaster, activeOperator, suspendedOperator];

const renderTeam = () =>
  renderToString(
    <TeamTab
      currentAdmin={signedInOwner}
      admins={admins}
      activeMembers={[]}
      partialErrors={[]}
      onRefresh={async () => {}}
    />
  );

describe('Settings → Tim Panitia account list grammar', () => {
  const html = renderTeam();

  it('locks the signed-in account and the default master owner out of selection', () => {
    // The selection guard has to stay visible: a checkbox that silently does
    // nothing is worse than the muted `-` the old table rendered.
    expect(html).not.toContain('aria-label="Pilih Admin Utama"');
    expect(html).not.toContain('aria-label="Pilih Super Admin"');
    expect(html).toContain('aria-label="Pilih Budi Petugas"');
  });

  it('keeps every state readable and colours the role into the meta line', () => {
    expect(html).toContain('Aktif');
    expect(html).toContain('Nonaktif');
    // A RowList has no badge slot: the role label becomes meta text.
    expect(html).toContain('Operator');
    expect(html).toContain('Default Master');
    expect(html).toContain('Divisi: Engineering');
    // The account list is a record list; only the RBAC matrix below it is a
    // table, and it must survive the cutover.
    expect(html.match(/<table/g)?.length).toBe(1);
    expect(html).toContain('Role-Based Access Control');
  });

  it('offers no delete control on the default master owner row', () => {
    expect(html).not.toContain('aria-label="Hapus akun Admin Utama"');
    expect(html).toContain('aria-label="Hapus akun Budi Petugas"');
  });
});