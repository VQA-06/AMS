import React, { useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Minus } from '@phosphor-icons/react/Minus';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { Trash } from '@phosphor-icons/react/Trash';
import { UserCheck } from '@phosphor-icons/react/UserCheck';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Users } from '@phosphor-icons/react/Users';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { X } from '@phosphor-icons/react/X';
import { Admin, Member, Role } from '@/shared/types';
import { fetchApi } from '../../lib/api-client';
import { getRoleInfo } from '../../lib/permissions';
import { Badge } from '../../components/ui/Badge';
import { BulkActionBar, BulkActionItem } from '../../components/ui/BulkActionBar';
import { Button } from '../../components/ui/Button';
import { Card, type MarkTone } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { AlertModal } from '../../components/ui/AlertModal';
import { Field } from '../../components/ui/Field';
import { ModalPortal } from '../../components/ui/ModalPortal';
import { Table, THead, TBody, TRow, TCell } from '../../components/ui/Table';
import { RowActions, type RowActionItem } from '../../components/ui/RowActions';
import { RowList, type RowListItem } from '../../components/ui/RowList';
import { cn } from '../../lib/cn';

interface TeamTabProps {
  currentAdmin: Admin | null;
  admins: Admin[];
  activeMembers: Member[];
  partialErrors: string[];
  onRefresh: () => Promise<void>;
}

/**
 * The team table's state mark. Its colour varies per row (seal when the account
 * is active, danger when access is revoked), so it encodes state rather than
 * decorating the surface. `TRow` draws it as a left border on the leading cell:
 * a CSS variant cannot reach that cell from the `<tr>`, because Tailwind
 * compiles `[&>*…]` into a grandchild selector no `<td>` matches.
 */
const adminMark = (status: Admin['status']): MarkTone =>
  status === 'active' ? 'seal' : 'danger';

/** The one focus quartet on every hand-rolled control in this file. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const iconButtonClass = (tone: 'neutral' | 'danger') =>
  cn(
    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-chip transition-colors duration-120 ease-out-expo',
    focusRing,
    tone === 'neutral' && 'text-ink-2 hover:bg-paper-sunk hover:text-ink',
    tone === 'danger' && 'text-ink-2 hover:bg-pending-50 hover:text-pending-700'
  );

type AccessLevel = 'full' | 'readonly' | 'none';
interface RbacRow {
  name: string;
  desc: string;
  owner: AccessLevel;
  admin: AccessLevel;
  operator: AccessLevel;
  auditor: AccessLevel;
}

const rbacMatrixData: RbacRow[] = [
  {
    name: 'Manajemen Tim Panitia & Hak Akses',
    desc: 'Membuat akun, reset password, ubah peran, dan hapus akun panitia',
    owner: 'full',
    admin: 'none',
    operator: 'none',
    auditor: 'none',
  },
  {
    name: 'Master Data Anggota Komunitas',
    desc: 'Mendaftarkan anggota baru, ubah biodata, impor CSV, dan hapus/nonaktifkan',
    owner: 'full',
    admin: 'full',
    operator: 'readonly',
    auditor: 'readonly',
  },
  {
    name: 'Agenda & Jadwal Acara Kegiatan',
    desc: 'Membuat kegiatan baru, ubah status, aktivasi sesi presensi, dan tutup kegiatan',
    owner: 'full',
    admin: 'full',
    operator: 'readonly',
    auditor: 'readonly',
  },
  {
    name: 'Manajemen Kode & Token QR',
    desc: 'Buat token sesi, atur masa berlaku, dan monitoring status code',
    owner: 'full',
    admin: 'full',
    operator: 'none',
    auditor: 'readonly',
  },
  {
    name: 'Rekapitulasi & Ekspor Laporan',
    desc: 'Lihat rekap keaktifan, ekspor data, dan cetak laporan',
    owner: 'full',
    admin: 'full',
    operator: 'none',
    auditor: 'full',
  },
  {
    name: 'Log Aktivitas & Audit Trail',
    desc: 'Pantau riwayat perubahan data dan aktivitas kritis sistem',
    owner: 'full',
    admin: 'none',
    operator: 'none',
    auditor: 'full',
  },
  {
    name: 'Konfigurasi Sistem & Backup',
    desc: 'Atur parameter aplikasi, trigger backup, danyum maintenance',
    owner: 'full',
    admin: 'none',
    operator: 'none',
    auditor: 'none',
  },
];

const roleTabs = [
  { id: 'owner', label: 'Owner' },
  { id: 'admin', label: 'Admin' },
  { id: 'operator', label: 'Operator' },
  { id: 'auditor', label: 'Auditor' },
] as const;

const renderCapabilityCell = (level: AccessLevel) => {
  if (level === 'full') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-chip border border-seal-200 bg-seal-50/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-seal-800">
        <CheckCircle className="h-3 w-3" weight="fill" />
        Penuh
      </span>
    );
  }
  if (level === 'readonly') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-chip border border-rule-strong bg-paper-sunk px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-2">
        <ShieldCheck className="h-3 w-3" />
        Baca Saja
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip border border-dashed border-rule-strong bg-transparent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-3">
      <Minus className="h-3 w-3" />
      Tidak Ada
    </span>
  );
};

/**
 * Owns the team roster, its two modals, and its multi-selection. Only the
 * roster itself and the "did this load" signal stay with the page shell,
 * because `loadData` fills both for every tab.
 */
export const TeamTab: React.FC<TeamTabProps> = ({
  currentAdmin,
  admins,
  activeMembers,
  onRefresh,
}) => {
  // Multi-Select for Team accounts
  const [selectedAdminIds, setSelectedAdminIds] = useState<Set<string>>(new Set());

  // Global Dialog State
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Edit admin form state
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editRole, setEditRole] = useState<Role>('operator');
  const [editStatus, setEditStatus] = useState<Admin['status']>('active');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState<boolean>(false);

  // New admin from member form state
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    type: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (opts: { type: 'success' | 'error' | 'info'; title: string; message?: string }) =>
    setAlert({ isOpen: true, type: opts.type, title: opts.title, message: opts.message });

  const [isAddAdminOpen, setIsAddAdminOpen] = useState<boolean>(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [newRole, setNewRole] = useState<Role>('operator');
  const [newPasswordAdmin, setNewPasswordAdmin] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  const handleAddAdminFromMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      setFormError('Pilih anggota terlebih dahulu.');
      return;
    }
    if (!newPasswordAdmin || newPasswordAdmin.length < 6) {
      setFormError('Password awal minimal 6 karakter.');
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setFormLoading(true);

    try {
      await fetchApi('/api/auth/admins', {
        method: 'POST',
        body: JSON.stringify({
          member_id: selectedMemberId,
          role: newRole,
          password: newPasswordAdmin,
        }),
      });

      setFormSuccess('Akun panitia berhasil dibuat dari data anggota.');
      setSelectedMemberId('');
      setNewPasswordAdmin('');
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat akun panitia.';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEditModal = (admin: Admin) => {
    setEditingAdmin(admin);
    setEditRole(admin.role);
    setEditStatus(admin.status);
    setEditPassword('');
    setEditError(null);
  };

  const handleSaveEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    if (editPassword && editPassword.length < 6) {
      setEditError('Password baru minimal 6 karakter.');
      return;
    }

    setEditError(null);
    setEditSaving(true);

    try {
      await fetchApi(`/api/auth/admins/${editingAdmin.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: editRole,
          status: editStatus,
          password: editPassword || undefined,
        }),
      });

      setEditingAdmin(null);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui akun panitia.';
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteAdmin = (admin: Admin) => {
    setDeletingAdmin(admin);
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!deletingAdmin) return;
    setDeleteLoading(true);

    try {
      await fetchApi(`/api/auth/admins/${deletingAdmin.id}`, { method: 'DELETE' });
      setDeletingAdmin(null);
      await onRefresh();
      showAlert({
        type: 'success',
        title: 'Berhasil Dihapus',
        message: `Akun panitia "${deletingAdmin.name}" berhasil dihapus permanen.`,
      });
    } catch (err: unknown) {
      setDeletingAdmin(null);
      showAlert({
        type: 'error',
        title: 'Gagal Menghapus Akun',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus akun panitia.',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectableAdmins = admins.filter(
    (a) => a.id !== currentAdmin?.id && !(a.role === 'owner' && a.member_id === null)
  );

  const isOwner = currentAdmin?.role === 'owner';

  const handleToggleSelectAdmin = (id: string) => {
    setSelectedAdminIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAllAdmins = () => {
    if (selectedAdminIds.size === selectableAdmins.length && selectableAdmins.length > 0) {
      setSelectedAdminIds(new Set());
    } else {
      setSelectedAdminIds(new Set(selectableAdmins.map((a) => a.id)));
    }
  };

  const handleClearAdminSelection = () => {
    setSelectedAdminIds(new Set());
  };

  /** The sentinel `handleBulkDeleteAdmins` sets; routes the modal to the
   *  bulk handler instead of the single-account one. */
  const isBulkDelete = deletingAdmin?.id === 'bulk';

  const handleBulkDeleteAdmins = () => {
    const ids = Array.from(selectedAdminIds);
    if (ids.length === 0) return;

    setDeletingAdmin({
      id: 'bulk',
      name: `${ids.length} Akun Panitia`,
      email: '',
      role: 'operator',
      status: 'active',
      created_at: '',
      updated_at: '',
      member_id: null,
      member_external_id: null,
      member_division: null,
    });
  };

  const handleConfirmBulkDeleteAdmins = async () => {
    const ids = Array.from(selectedAdminIds);
    if (ids.length === 0) return;

    try {
      setDeleteLoading(true);
      await fetchApi('/api/auth/admins/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      setDeletingAdmin(null);
      setSelectedAdminIds(new Set());
      await onRefresh();
      showAlert({
        type: 'success',
        title: 'Berhasil Dihapus',
        message: `${ids.length} akun tim berhasil dihapus permanen.`,
      });
    } catch (err) {
      setDeletingAdmin(null);
      showAlert({
        type: 'error',
        title: 'Gagal Menghapus Akun Tim',
        message: err instanceof Error ? err.message : 'Gagal menghapus akun tim terpilih.',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  /** Rows that may carry a checkbox. `RowList` needs this as an id set; the
   *  same array still drives `handleToggleSelectAllAdmins`. */
  const selectableAdminIdSet = new Set(selectableAdmins.map((a) => a.id));

  const adminBulkActions: BulkActionItem[] = isOwner
    ? [
        {
          label: 'Hapus',
          icon: <Trash className="w-3.5 h-3.5" />,
          variant: 'danger' as const,
          onClick: handleBulkDeleteAdmins,
        },
      ]
    : [];

  const adminItems: RowListItem[] = admins.map((adm) => {
    const roleInfo = getRoleInfo(adm.role);
    const meta = [
      roleInfo.label,
      adm.email,
      adm.member_id ? 'Terkait Anggota' : 'Default Master',
      adm.member_division ? `Divisi: ${adm.member_division}` : null,
    ]
      .filter(Boolean)
      .join('  ·  ');

    const canDelete = adm.id !== 'adm_owner_default' && adm.id !== currentAdmin?.id;

    const menuItems: RowActionItem[] = [
      {
        label: `Edit ${adm.name}`,
        icon: <PencilSimple className="h-4 w-4" />,
        onSelect: () => handleOpenEditModal(adm),
      },
      ...(canDelete
        ? [
            {
              label: `Hapus ${adm.name}`,
              icon: <Trash className="h-4 w-4" />,
              onSelect: () => handleDeleteAdmin(adm),
              tone: 'danger' as const,
            },
          ]
        : []),
    ];

    return {
      id: adm.id,
      title: adm.name,
      meta: meta || undefined,
      status: {
        label: adm.status === 'active' ? 'Aktif' : 'Nonaktif',
        tone: adminMark(adm.status),
      },
      action: isOwner ? (
        <span className="flex items-center gap-1">
          {/* Desktop keeps the inline cluster; below `sm` the same actions live
              in the kebab, because two 44px targets do not fit a 344px row. */}
          <span className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => handleOpenEditModal(adm)}
              title="Edit Akun Panitia"
              aria-label={`Edit akun ${adm.name}`}
              className={iconButtonClass('neutral')}
            >
              <PencilSimple className="h-4 w-4" />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => handleDeleteAdmin(adm)}
                title="Hapus Akun Panitia"
                aria-label={`Hapus akun ${adm.name}`}
                className={iconButtonClass('danger')}
              >
                <Trash className="h-4 w-4" />
              </button>
            )}
          </span>
          <RowActions className="sm:hidden" label={`Menu aksi ${adm.name}`} items={menuItems} />
        </span>
      ) : undefined,
    };
  });

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Panitia Accounts List */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-rule pb-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
              <Users className="h-5 w-5 text-ink-2" />
              <span>Daftar Akun Tim Panitia</span>
            </h2>
            <p className="mt-0.5 text-xs text-ink-2">
              Kelola hak otorisasi dan penugasan peran operasional akun panitia AMS Computer Community
            </p>
          </div>

          {isOwner && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setFormError(null);
                setFormSuccess(null);
                setSelectedMemberId('');
                setNewPasswordAdmin('');
                setIsAddAdminOpen(true);
              }}
            >
              Tambah Akun Panitia
            </Button>
          )}
        </div>

        <RowList
          items={adminItems}
          selectable={isOwner}
          selectableIds={isOwner ? selectableAdminIdSet : undefined}
          selectedIds={selectedAdminIds}
          onToggle={handleToggleSelectAdmin}
          onToggleAll={handleToggleSelectAllAdmins}
          itemLabel="akun panitia"
        />

        {/* Contextual Floating Bulk Action Bar for Team Tab */}
        <BulkActionBar
          selectedCount={selectedAdminIds.size}
          onClearSelection={handleClearAdminSelection}
          actions={adminBulkActions}
        />
      </Card>

      {/* Role-Based Access Control (RBAC) Matrix Table */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-2 border-b border-rule pb-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
              <ShieldCheck className="h-5 w-5 text-seal-600" />
              <span>Matriks Hak Akses Peran (RBAC Matrix)</span>
            </h2>
            <p className="mt-0.5 text-xs text-ink-2">
              Spesifikasi hak otorisasi dan batas kewenangan operasional per peran pada sistem presensi AMS
            </p>
          </div>
          <Badge variant="neutral" size="xs">
            Role-Based Access Control
          </Badge>
        </div>

        <Table className="rounded-panel border border-rule">
          <THead>
            <tr>
              <TCell header className="min-w-[240px]">
                Fitur &amp; Kapabilitas Sistem
              </TCell>
              {roleTabs.map((role) => (
                <TCell key={role.id} header className="min-w-[120px] text-center">
                  <Badge variant={getRoleInfo(role.id).variant} size="xs">
                    {role.label}
                  </Badge>
                </TCell>
              ))}
            </tr>
          </THead>
          <TBody>
            {rbacMatrixData.map((row) => (
              <TRow key={row.name}>
                <TCell>
                  <div className="max-w-[22rem] font-semibold text-ink">{row.name}</div>
                  <div className="mt-0.5 max-w-[22rem] text-[11px] text-ink-2">{row.desc}</div>
                </TCell>
                <TCell className="text-center">{renderCapabilityCell(row.owner)}</TCell>
                <TCell className="text-center">{renderCapabilityCell(row.admin)}</TCell>
                <TCell className="text-center">{renderCapabilityCell(row.operator)}</TCell>
                <TCell className="text-center">{renderCapabilityCell(row.auditor)}</TCell>
              </TRow>
            ))}
          </TBody>
        </Table>
      </Card>

      {/* Modal Tambah Akun Panitia */}
      {isAddAdminOpen && (
        <ModalPortal onClose={() => setIsAddAdminOpen(false)}>
          <div className="modal-backdrop-full">
            <div className="surface my-auto max-h-[86dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-bezel p-3.5 sm:space-y-4 sm:p-6">
              <div className="flex items-center justify-between border-b border-rule pb-2.5 sm:pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-ink-2" />
                  <h2 className="font-heading text-base font-bold text-ink">
                    Tambah Akun Panitia Baru
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddAdminOpen(false)}
                  aria-label="Tutup"
                  className={iconButtonClass('neutral')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-chip border border-pen-200 bg-pen-50/70 px-3 py-3 text-xs text-pen-deep"
                >
                  <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-2 rounded-chip border border-seal-200 bg-seal-50/70 px-3 py-3 text-xs text-seal-800"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddAdminFromMember} className="space-y-3.5 text-xs">
                <Field
                  id="pages-settings-teamtab-field-6"
                  label="Pilih Anggota Utama / Universal:"
                  control="select"
                  required
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                  hint={
                    activeMembers.filter((m) => !admins.some((a) => a.member_id === m.id)).length === 0
                      ? 'Semua anggota aktif sudah terdaftar memiliki akun panitia.'
                      : undefined
                  }
                  options={[
                    { value: '', label: '-- Pilih Anggota Aktif --' },
                    ...activeMembers
                      .filter((m) => !admins.some((a) => a.member_id === m.id))
                      .map((m) => ({
                        value: m.id,
                        label: `${m.name} (${m.external_id}) ${m.division ? `[${m.division}]` : ''}`,
                      })),
                  ]}
                />

                <Field
                  id="pages-settings-teamtab-field-7"
                  label="Role / Peran Akun:"
                  control="select"
                  value={newRole}
                  onChange={(v) => setNewRole(v as Role)}
                  options={[
                    { value: 'operator', label: 'Operator (Pos Scanner & Cek Event)' },
                    { value: 'admin', label: 'Admin (Kelola Anggota, Event, QR)' },
                    { value: 'auditor', label: 'Auditor (Read-Only Rekap & Laporan)' },
                    { value: 'owner', label: 'Owner (Hak Akses Penuh / Super Admin)' },
                  ]}
                />

                <Field
                  id="pages-settings-teamtab-field-8"
                  label="Password Awal (Min. 6 Karakter):"
                  control="password"
                  required
                  value={newPasswordAdmin}
                  onChange={setNewPasswordAdmin}
                  placeholder="Contoh: Panitia123!"
                  controlClassName="font-oxanium"
                />

                <div className="flex items-center justify-end gap-2 border-t border-rule pt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddAdminOpen(false)}>
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={formLoading}
                    loading={formLoading}
                    icon={<UserCheck className="h-4 w-4" />}
                    size="sm"
                  >
                    Buat Akun Tim
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <ModalPortal onClose={() => setEditingAdmin(null)}>
          <div className="modal-backdrop-full">
            <div className="surface my-auto max-h-[86dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-bezel p-3.5 sm:space-y-4 sm:p-6">
              <div className="flex items-center justify-between border-b border-rule pb-2.5 sm:pb-3">
                <div className="flex items-center gap-2">
                  <PencilSimple className="h-4 w-4 text-ink-2" />
                  <h2 className="font-heading text-base font-bold text-ink">Edit Akun Panitia</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  aria-label="Tutup"
                  className={iconButtonClass('neutral')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="surface-raised space-y-1 rounded-panel p-3 text-xs">
                <div className="truncate font-semibold text-ink">{editingAdmin.name}</div>
                <div className="truncate font-oxanium text-ink-2">{editingAdmin.email}</div>
                {editingAdmin.member_external_id && (
                  <div className="truncate font-oxanium text-[11px] text-ink-2">
                    Kode Anggota: {editingAdmin.member_external_id}
                  </div>
                )}
              </div>

              {editError && (
                <div
                  role="alert"
                  className="rounded-chip border border-pen-200 bg-pen-50/70 px-3 py-3 text-xs text-pen-deep"
                >
                  {editError}
                </div>
              )}

              <form onSubmit={handleSaveEditAdmin} className="space-y-3 text-xs">
                <Field
                  id="pages-settings-teamtab-field-9"
                  label="Role / Peran:"
                  control="select"
                  value={editRole}
                  onChange={(v) => setEditRole(v as Role)}
                  options={[
                    { value: 'operator', label: 'Operator (Pos Scanner & Cek Event)' },
                    { value: 'admin', label: 'Admin (Kelola Anggota, Event, QR)' },
                    { value: 'auditor', label: 'Auditor (Read-Only Rekap & Laporan)' },
                    { value: 'owner', label: 'Owner (Hak Akses Penuh / Super Admin)' },
                  ]}
                />

                <Field
                  id="pages-settings-teamtab-field-11"
                  label="Status Akun:"
                  control="select"
                  disabled={editingAdmin.id === 'adm_owner_default'}
                  value={editStatus}
                  onChange={(v) => setEditStatus(v === 'inactive' ? 'inactive' : 'active')}
                  hint={editingAdmin.id === 'adm_owner_default' ? 'Status akun owner default tidak dapat diubah.' : undefined}
                  options={[
                    { value: 'active', label: 'Aktif' },
                    { value: 'inactive', label: 'Nonaktif (Akses Dicabut)' },
                  ]}
                />

                <Field
                  id="pages-settings-teamtab-field-10"
                  label="Reset Password Baru (Kosongkan jika tidak diubah):"
                  control="password"
                  value={editPassword}
                  onChange={setEditPassword}
                  placeholder="Masukkan password baru"
                  controlClassName="font-oxanium"
                />

                <div className="flex items-center justify-end gap-2 border-t border-rule pt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingAdmin(null)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={editSaving} loading={editSaving} size="sm">
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Admin Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingAdmin)}
        title={isBulkDelete ? 'Hapus Akun Panitia Terpilih' : 'Hapus Akun Panitia'}
        message={
          deletingAdmin ? (
            isBulkDelete ? (
              <span>
                Yakin ingin <strong>MENGHAPUS PERMANEN</strong>{' '}
                <strong className="text-ink">{selectedAdminIds.size} akun panitia</strong> yang
                dipilih? Akun-akun ini tidak akan dapat login lagi ke sistem.
              </span>
            ) : (
              <span>
                Yakin ingin <strong>MENGHAPUS PERMANEN</strong> akun panitia{' '}
                <strong className="text-ink">"{deletingAdmin.name}"</strong> (
                {deletingAdmin.email})? Akun ini tidak akan dapat login lagi ke sistem.
              </span>
            )
          ) : (
            ''
          )
        }
        type="danger"
        confirmText={
          isBulkDelete ? `Ya, Hapus ${selectedAdminIds.size} Akun` : 'Ya, Hapus Permanen'
        }
        cancelText="Batal"
        loading={deleteLoading}
        onConfirm={isBulkDelete ? handleConfirmBulkDeleteAdmins : handleConfirmDeleteAdmin}
        onClose={() => setDeletingAdmin(null)}
      />

      <AlertModal
        isOpen={alert.isOpen}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
