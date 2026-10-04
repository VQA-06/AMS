import React, { useState, useEffect } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise';
import { Check } from '@phosphor-icons/react/Check';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { DeviceMobile } from '@phosphor-icons/react/DeviceMobile';
import { Eye } from '@phosphor-icons/react/Eye';
import { EyeSlash } from '@phosphor-icons/react/EyeSlash';
import { LockKey } from '@phosphor-icons/react/LockKey';
import { Minus } from '@phosphor-icons/react/Minus';
import { PencilSimple } from '@phosphor-icons/react/PencilSimple';
import { Plus } from '@phosphor-icons/react/Plus';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { Trash } from '@phosphor-icons/react/Trash';
import { UserCheck } from '@phosphor-icons/react/UserCheck';
import { UserPlus } from '@phosphor-icons/react/UserPlus';
import { Users } from '@phosphor-icons/react/Users';
import { Warning } from '@phosphor-icons/react/Warning';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { X } from '@phosphor-icons/react/X';
import { Admin, AuditLog, Member, Role } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ModalPortal } from '../components/ui/ModalPortal';
import { AlertModal } from '../components/ui/AlertModal';
import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, THead, TBody, TRow, TCell } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { type MarkTone } from '../components/ui/Card';
import { getRoleInfo } from '../lib/permissions';

/**
 * The team table's state mark. Its colour varies per row (jade when the
 * account is active, danger when access is revoked), so it encodes state
 * rather than decorating the surface. `TRow` draws it as a left border on the
 * leading cell: a CSS variant cannot reach that cell from the `<tr>`, because
 * Tailwind compiles `[&>*…]` into a grandchild selector no `<td>` matches.
 */
const adminMark = (status: Admin['status']): MarkTone =>
  status === 'active' ? 'seal' : 'danger';

const inputClass =
  'w-full rounded-chip border border-rule-strong bg-ink px-3 py-2.5 text-xs text-paper placeholder:text-ink-3 focus:border-pen-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const monoInputClass = `${inputClass} font-oxanium`;

const iconButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-chip border border-rule-strong bg-paper-raised text-ink transition-colors duration-120 hover:border-rule-strong hover:text-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export const SettingsPage: React.FC = () => {
  const { admin: currentAdmin, updateProfile } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'audit' | 'system'>('profile');
  const [, setLoading] = useState<boolean>(false);

  // Multi-Select for Team accounts
  const [selectedAdminIds, setSelectedAdminIds] = useState<Set<string>>(new Set());

  // Global Dialog State
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [clearingCache, setClearingCache] = useState<boolean>(false);
  /** Sections that failed to load; shown as a warning instead of fake "no data". */
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'error' | 'success' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });

  // Profile update form state
  const [profileName, setProfileName] = useState<string>(currentAdmin?.name || '');
  const [profileEmail, setProfileEmail] = useState<string>(currentAdmin?.email || '');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);

  // New admin from member form state
  const [isAddAdminOpen, setIsAddAdminOpen] = useState<boolean>(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [newRole, setNewRole] = useState<Role>('operator');
  const [newPasswordAdmin, setNewPasswordAdmin] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // RBAC Matrix data structure for enterprise access control
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
      name: 'Tiket JWE & Cetak Badge QR Universal',
      desc: 'Generate token terenkripsi AES-256-GCM dan cetak kartu lembar A4 / PDF',
      owner: 'full',
      admin: 'full',
      operator: 'none',
      auditor: 'none',
    },
    {
      name: 'Pemindaian Presensi (Scanner)',
      desc: 'Validasi QR anggota via kamera mobile/webcam dan input presensi manual',
      owner: 'full',
      admin: 'full',
      operator: 'full',
      auditor: 'none',
    },
    {
      name: 'Ekspor Data Rekapitulasi Presensi',
      desc: 'Unduh laporan matriks kehadiran dalam format spreadsheet / CSV resmi',
      owner: 'full',
      admin: 'full',
      operator: 'none',
      auditor: 'full',
    },
    {
      name: 'Audit Log Sistem & Keamanan',
      desc: 'Memantau rekaman log aktivitas keamanan, mutasi data, dan autentikasi',
      owner: 'full',
      admin: 'none',
      operator: 'none',
      auditor: 'full',
    },
  ];

  const renderCapabilityCell = (level: AccessLevel) => {
    switch (level) {
      case 'full':
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-seal-800">
            <Check className="w-3.5 h-3.5" />
            <span className="text-[11px]">Penuh</span>
          </span>
        );
      case 'readonly':
        return (
          <span className="inline-flex items-center gap-1 font-medium text-pending-800">
            <Check className="w-3 h-3 text-pending-600" />
            <span className="text-[11px]">Hanya Baca</span>
          </span>
        );
      case 'none':
      default:
        return (
          <span className="inline-flex items-center gap-1 font-medium text-ink-2" title="Tidak Memiliki Akses">
            <Minus className="h-3.5 w-3.5" />
            <span className="text-[11px]">Tidak Ada</span>
          </span>
        );
    }
  };

  // Edit Admin Modal state
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editRole, setEditRole] = useState<Role>('operator');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (currentAdmin) {
      setProfileName(currentAdmin.name);
      setProfileEmail(currentAdmin.email);
    }
  }, [currentAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      const settled = await Promise.allSettled([
        fetchApi<{ admins: Admin[] }>('/api/auth/admins'),
        fetchApi<{ logs: AuditLog[] }>('/api/audit/logs'),
        fetchApi<{ members: Member[] }>('/api/members?status=active&limit=500'),
      ]);

      // Falling back to empty arrays made a failed request look like "no data
      // exists", so the admin roster and audit log silently appeared empty.
      const failed = ['Daftar Panitia', 'Log Audit', 'Daftar Anggota'];
      setPartialErrors(
        settled.flatMap((r, i) => (r.status === 'rejected' ? [failed[i]] : []))
      );

      const [admRes, logRes, memRes] = settled.map((r) =>
        r.status === 'fulfilled' ? r.value : null
      ) as [{ admins: Admin[] } | null, { logs: AuditLog[] } | null, { members: Member[] } | null];

      setAdmins(admRes?.admins || []);
      setAuditLogs(logRes?.logs || []);
      setActiveMembers(memRes?.members || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setProfileErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setProfileErrorMsg('Password baru minimal 6 karakter.');
      return;
    }

    setProfileSaving(true);
    try {
      await updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });

      setProfileSuccessMsg('Profil dan data akun berhasil diperbarui.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui profil.';
      setProfileErrorMsg(msg);
    } finally {
      setProfileSaving(false);
    }
  };

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
      await loadData();
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
      await loadData();
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
      await loadData();
      setAlertModal({
        isOpen: true,
        title: 'Berhasil Dihapus',
        message: `Akun panitia "${deletingAdmin.name}" berhasil dihapus permanen.`,
        type: 'success',
      });
    } catch (err: unknown) {
      setDeletingAdmin(null);
      setAlertModal({
        isOpen: true,
        title: 'Gagal Menghapus Akun',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus akun panitia.',
        type: 'error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectableAdmins = admins.filter(
    (a) => a.id !== currentAdmin?.id && !(a.role === 'owner' && a.member_id === null)
  );

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
      await loadData();
      setAlertModal({
        isOpen: true,
        title: 'Berhasil Dihapus',
        message: `${ids.length} akun tim berhasil dihapus permanen.`,
        type: 'success',
      });
    } catch (err) {
      setDeletingAdmin(null);
      setAlertModal({
        isOpen: true,
        title: 'Gagal Menghapus Akun Tim',
        message: err instanceof Error ? err.message : 'Gagal menghapus akun tim terpilih.',
        type: 'error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const adminBulkActions: BulkActionItem[] = currentAdmin?.role === 'owner'
    ? [
        {
          label: 'Hapus',
          icon: <Trash className="w-3.5 h-3.5" />,
          variant: 'danger' as const,
          onClick: handleBulkDeleteAdmins,
        },
      ]
    : [];

const [isOnline, setIsOnline] = useState<boolean>(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  const [serviceWorkerState, setServiceWorkerState] = useState<'checking' | 'active' | 'unsupported'>(
    'checking'
  );
  const [systemNotice, setSystemNotice] = useState<string | null>(null);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setServiceWorkerState('unsupported');
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!cancelled) setServiceWorkerState(reg ? 'active' : 'unsupported');
      })
      .catch(() => {
        if (!cancelled) setServiceWorkerState('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckForUpdate = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    setSystemNotice('Memeriksa pembaruan Service Worker...');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setSystemNotice('Service Worker belum terdaftar di perangkat ini.');
        return;
      }
      await reg.update();
      setSystemNotice('Pemeriksaan update Service Worker berhasil dijalankan.');
    } catch {
      setSystemNotice('Pemeriksaan update Service Worker gagal dijalankan.');
    }
  };

  const roleTabs = [
    { id: 'owner', label: 'Owner' },
    { id: 'admin', label: 'Admin' },
    { id: 'operator', label: 'Operator' },
    { id: 'auditor', label: 'Auditor' },
  ] as const;
  const currentRoleInfo = getRoleInfo(currentAdmin?.role);



  return (
    <div className="space-y-5 pb-24 md:space-y-8 md:pb-12">
      <PageHeader
        title="Pengaturan & Profil"
        subtitle="Kelola profil akun, ubah password, hak akses panitia, dan audit log AMS Computer Community"
      />

      {partialErrors.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-panel border border-pending-200 bg-pending-50/70 px-4 py-3 text-xs text-pending-800"
        >
          <Warning className="mt-0.5 h-4 w-4 shrink-0 text-pending-600" />
          <span>
            Sebagian data gagal dimuat: {partialErrors.join(', ')}. Daftar di bawah
            mungkin tidak lengkap, bukan kosong.
          </span>
        </div>
      )}

      <Tabs
        items={[
          { id: 'profile', label: 'Profil & Keamanan Saya' },
          { id: 'team', label: 'Tim Panitia & Akses' },
          { id: 'audit', label: 'Audit Log Sistem' },
          { id: 'system', label: 'Info Sistem Cloudflare' },
        ]}
        active={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
        variant="underline"
        ariaLabel="Bagian pengaturan"
      />

      {/* Tab 0: Profile & Security Management */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {/* Account Overview Card */}
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-panel bg-pen-500 font-heading text-lg font-bold text-paper">
                {currentAdmin?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-base font-bold text-ink">
                  {currentAdmin?.name}
                </h2>
                <p className="truncate font-oxanium text-xs text-ink-2">{currentAdmin?.email}</p>
              </div>
            </div>

            <dl className="space-y-2 border-t border-rule pt-3 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-chip bg-paper-raised px-3 py-2.5">
                <dt className="text-ink-2">Tingkat Akses:</dt>
                <dd>
                  <Badge variant={currentRoleInfo.variant} size="xs">
                    {currentRoleInfo.label}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-chip bg-paper-raised px-3 py-2.5">
                <dt className="text-ink-2">Status Akun:</dt>
                <dd>
                  <Badge variant={currentAdmin?.status === 'active' ? 'seal' : 'danger'} size="xs" dot>
                    {currentAdmin?.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-chip bg-paper-raised px-3 py-2.5">
                <dt className="shrink-0 text-ink-2">ID Admin:</dt>
                <dd className="truncate font-oxanium text-[11px] text-ink">{currentAdmin?.id}</dd>
              </div>
            </dl>

            <p className="flex items-start gap-2 rounded-panel border border-rule bg-paper-raised px-3.5 py-3 text-[11px] text-ink-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" />
              <span>{currentRoleInfo.description}</span>
            </p>
          </Card>

          {/* Edit Profile & Password Form */}
          <Card className="space-y-5 p-5 sm:p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
              <LockKey className="h-4 w-4 text-ink-2" />
              <span>Kelola Profil & Ganti Password</span>
            </h2>

            {profileSuccessMsg && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-2.5 rounded-panel border border-seal-200 bg-seal-50/70 px-3.5 py-3 text-xs text-seal-800"
              >
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-seal-600" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-panel border border-pen-200 bg-pen-50/70 px-3.5 py-3 text-xs text-pen-deep"
              >
                <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-pen" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id="pages-settingspage-field-1"
                  label="Nama Lengkap:"
                  control="text"
                  required
                  value={profileName}
                  onChange={setProfileName}
                  autoComplete="name"
                />

                <Field
                  id="pages-settingspage-field-2"
                  label="Email / Username:"
                  control="email"
                  required
                  value={profileEmail}
                  onChange={setProfileEmail}
                  autoComplete="email"
                  controlClassName="font-oxanium"
                />
              </div>

              <div className="space-y-3 border-t border-rule pt-3">
                <p className="text-xs font-bold text-ink">
                  Ganti Password <span className="font-normal text-ink-2">(Kosongkan jika tidak ingin mengubah)</span>
                </p>

                <Field
                  id="pages-settingspage-field-3"
                  label="Password Saat Ini:"
                  control="password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Masukkan password sekarang"
                  controlClassName="font-oxanium"
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    id="pages-settingspage-field-4"
                    label="Password Baru:"
                    control="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Minimal 6 karakter"
                    hint="Minimal 6 karakter"
                    autoComplete="new-password"
                    controlClassName="font-oxanium"
                  />

                  <Field
                    id="pages-settingspage-field-5"
                    label="Konfirmasi Password Baru:"
                    control="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Ketik ulang password baru"
                    autoComplete="new-password"
                    controlClassName="font-oxanium"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={profileSaving}
                  loading={profileSaving}
                  icon={<CheckCircle className="h-4 w-4" />}
                >
                  Simpan Perubahan Profil
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Tab 1: Team Management */}
      {activeTab === 'team' && (
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

              {currentAdmin?.role === 'owner' && (
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

            <Table className="rounded-panel border border-rule">
              <THead>
                <tr>
                  {currentAdmin?.role === 'owner' && (
                    <TCell header className="w-10 text-center">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua akun panitia"
                        checked={selectableAdmins.length > 0 && selectedAdminIds.size === selectableAdmins.length}
                        onChange={handleToggleSelectAllAdmins}
                        className="h-4 w-4 cursor-pointer rounded border-rule-strong bg-ink accent-pen-500"
                        title={selectedAdminIds.size === selectableAdmins.length ? 'Batalkan pilih semua' : 'Pilih semua'}
                      />
                    </TCell>
                  )}
                  <TCell header>Nama & Identitas</TCell>
                  <TCell header>Role / Peran</TCell>
                  <TCell header>Tipe Akun</TCell>
                  <TCell header>Status</TCell>
                  {currentAdmin?.role === 'owner' && <TCell header className="text-right">Aksi</TCell>}
                </tr>
              </THead>
              <TBody>
                {admins.map((adm) => {
                  const isSelectable = adm.id !== currentAdmin?.id && !(adm.role === 'owner' && adm.member_id === null);
                  const isSelected = selectedAdminIds.has(adm.id);
                  const roleInfo = getRoleInfo(adm.role);
                  return (
                    <TRow key={adm.id} selected={isSelected} mark={adminMark(adm.status)}>
                      {currentAdmin?.role === 'owner' && (
                        <TCell className="w-10 text-center">
                          {isSelectable ? (
                            <input
                              type="checkbox"
                              aria-label={`Pilih akun ${adm.name}`}
                              checked={isSelected}
                              onChange={() => handleToggleSelectAdmin(adm.id)}
                              className="h-4 w-4 cursor-pointer rounded border-rule-strong bg-ink accent-pen-500"
                            />
                          ) : (
                            <span className="text-xs text-ink-3">-</span>
                          )}
                        </TCell>
                      )}
                      <TCell>
                        <div className="max-w-[16rem] truncate font-semibold text-ink">{adm.name}</div>
                        <div className="max-w-[16rem] truncate font-oxanium text-[11px] text-ink-2">
                          {adm.email}
                        </div>
                        {adm.member_division && (
                          <span className="mt-0.5 inline-block max-w-[16rem] truncate rounded-chip border border-pen-200 bg-pen-50/70 px-1.5 py-0.5 text-[10px] text-ink-2">
                            Divisi: {adm.member_division}
                          </span>
                        )}
                      </TCell>
                      <TCell>
                        <Badge variant={roleInfo.variant} size="xs">
                          {roleInfo.label}
                        </Badge>
                      </TCell>
                      <TCell className="text-[11px] text-ink-2">
                        {adm.member_id ? 'Terkait Anggota' : 'Default Master'}
                      </TCell>
                      <TCell>
                        <Badge variant={adm.status === 'active' ? 'seal' : 'danger'} size="xs" dot>
                          {adm.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TCell>
                      {currentAdmin?.role === 'owner' && (
                        <TCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(adm)}
                              aria-label={`Edit akun ${adm.name}`}
                              className={iconButtonClass}
                              title="Edit Akun Panitia"
                            >
                              <PencilSimple className="h-3.5 w-3.5" />
                            </button>
                            {adm.id !== 'adm_owner_default' && adm.id !== currentAdmin.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAdmin(adm)}
                                aria-label={`Hapus akun ${adm.name}`}
                                className={`${iconButtonClass} hover:border-pen-600 hover:text-pen-deep`}
                                title="Hapus Akun Panitia"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </TCell>
                      )}
                    </TRow>
                  );
                })}
              </TBody>
            </Table>

            {/* Contextual Floating Bulk Action Bar for Team Tab */}
            <BulkActionBar
              selectedCount={selectedAdminIds.size}
              totalCount={selectableAdmins.length}
              itemLabel="Akun"
              onClearSelection={handleClearAdminSelection}
              onSelectAll={handleToggleSelectAllAdmins}
              isAllSelected={selectableAdmins.length > 0 && selectedAdminIds.size === selectableAdmins.length}
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
                <div className="surface my-auto w-full max-w-md space-y-4 rounded-bezel p-5 shadow-ambient sm:p-6">
                  <div className="flex items-center justify-between border-b border-rule pb-3">
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
                      className={iconButtonClass}
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
                      id="pages-settingspage-field-6"
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
                      id="pages-settingspage-field-7"
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
                      id="pages-settingspage-field-8"
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
                <div className="surface my-auto w-full max-w-md space-y-3.5 rounded-bezel p-4 shadow-ambient sm:space-y-4 sm:p-6">
                  <div className="flex items-center justify-between border-b border-rule pb-3">
                    <div className="flex items-center gap-2">
                      <PencilSimple className="h-4 w-4 text-ink-2" />
                      <h2 className="font-heading text-base font-bold text-ink">Edit Akun Panitia</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingAdmin(null)}
                      aria-label="Tutup"
                      className={iconButtonClass}
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
                      id="pages-settingspage-field-9"
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
                      id="pages-settingspage-field-11"
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
                      id="pages-settingspage-field-10"
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
        </div>
      )}

      {/* Tab 2: Audit Logs */}
      {activeTab === 'audit' && (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TCell header>Waktu</TCell>
                <TCell header>Aksi</TCell>
                <TCell header>Pelaksana</TCell>
                <TCell header>Detail</TCell>
              </tr>
            </THead>
            <TBody>
              {auditLogs.map((log) => (
                <TRow key={log.id}>
                  <TCell className="whitespace-nowrap font-oxanium text-ink-2">
                    {new Date(log.created_at).toLocaleString('id-ID')}
                  </TCell>
                  <TCell truncate className="font-semibold text-ink-2">
                    {log.action}
                  </TCell>
                  <TCell truncate className="text-ink">
                    {log.admin_name || log.admin_email || 'Sistem / Dev'}
                  </TCell>
                  <TCell truncate className="font-oxanium text-ink-2">
                    {typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta)}
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {/* Tab 3: System Status — real runtime state only */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
          <Card className="space-y-4 p-5 sm:p-6 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
                <DeviceMobile className="h-4 w-4 text-seal-600" />
                <span>Progressive Web App (PWA) &amp; Offline Shell</span>
              </h2>
              <Badge variant="seal" size="xs">
                Terpasang sebagai PWA
              </Badge>
            </div>

            <p className="text-xs text-ink">
              AMS mendukung instalasi mandiri di Android, iOS, Windows, macOS, dan Linux dengan kemampuan caching offline penuh.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-1 text-xs sm:grid-cols-3">
              <div className="surface-raised space-y-1 rounded-panel p-3.5">
                <span className="block text-[11px] font-medium text-ink-2">Mode Tampilan:</span>
                <span className="font-bold text-ink-2">
                  {typeof window !== 'undefined' &&
                  (window.matchMedia('(display-mode: standalone)').matches ||
                    (window.navigator as unknown as { standalone?: boolean }).standalone)
                    ? 'Aplikasi Mandiri (Standalone PWA)'
                    : 'Peramban Web (Browser)'}
                </span>
              </div>

              <div className="surface-raised space-y-1 rounded-panel p-3.5">
                <span className="block text-[11px] font-medium text-ink-2">Service Worker:</span>
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  {serviceWorkerState === 'active' ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 text-seal-600" />
                      Aktif &amp; Terdaftar
                    </>
                  ) : serviceWorkerState === 'checking' ? (
                    <>
                      <ArrowClockwise className="h-3.5 w-3.5 text-pending-600 animate-pulse" />
                      Memeriksa...
                    </>
                  ) : (
                    <>
                      <Minus className="h-3.5 w-3.5 text-ink-2" />
                      Tidak Terdaftar
                    </>
                  )}
                </span>
              </div>

              <div className="surface-raised space-y-1 rounded-panel p-3.5">
                <span className="block text-[11px] font-medium text-ink-2">Konektivitas Jaringan:</span>
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${isOnline ? 'bg-seal-400' : 'bg-pen-400'}`}
                  />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {systemNotice && (
              <p role="status" aria-live="polite" className="text-xs text-ink-2">
                {systemNotice}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCheckForUpdate}
                icon={<ArrowClockwise className="h-3.5 w-3.5" />}
              >
                Cek Pembaruan App
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearingCache(true)}
                icon={<Trash className="h-3.5 w-3.5" />}
              >
                Bersihkan Cache Offline &amp; Reload
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Admin Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingAdmin)}
        title="Hapus Akun Panitia"
        message={
          deletingAdmin ? (
            <span>
              Yakin ingin <strong>MENGHAPUS PERMANEN</strong> akun panitia{' '}
              <strong className="text-ink">"{deletingAdmin.name}"</strong> ({deletingAdmin.email})?
              Akun ini tidak akan dapat login lagi ke sistem.
            </span>
          ) : (
            ''
          )
        }
        type="danger"
        confirmText="Ya, Hapus Permanen"
        cancelText="Batal"
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteAdmin}
        onClose={() => setDeletingAdmin(null)}
      />

      <ConfirmModal
        isOpen={clearingCache}
        title="Bersihkan Cache Offline"
        message="Semua aset offline (service worker & cache browser) akan dihapus dan aplikasi dimuat ulang. Anda tetap bisa masuk, tetapi data yang belum tersinkron akan hilang."
        type="warning"
        confirmText="Ya, Bersihkan Cache"
        cancelText="Batal"
        onClose={() => setClearingCache(false)}
        onConfirm={async () => {
          setClearingCache(false);
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map((name) => caches.delete(name)));
          }
          window.location.reload();
        }}
      />

      {/* Alert / Notification Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
