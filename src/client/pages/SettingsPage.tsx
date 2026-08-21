import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  UserPlus,
  History,
  Key,
  Database,
  User,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Edit2,
  Trash2,
  QrCode,
  UserCheck,
  X,
} from 'lucide-react';
import { Admin, AuditLog, Member, Role } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';
import { BulkActionBar, BulkActionItem } from '@/client/components/ui/BulkActionBar';

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
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [newRole, setNewRole] = useState<Role>('operator');
  const [newPasswordAdmin, setNewPasswordAdmin] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

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
      const [admRes, logRes, memRes] = await Promise.all([
        fetchApi<{ admins: Admin[] }>('/api/auth/admins').catch(() => ({ admins: [] })),
        fetchApi<{ logs: AuditLog[] }>('/api/audit/logs').catch(() => ({ logs: [] })),
        fetchApi<{ members: Member[] }>('/api/members?status=active&limit=500').catch(() => ({ members: [] })),
      ]);

      setAdmins(admRes.admins || []);
      setAuditLogs(logRes.logs || []);
      setActiveMembers(memRes.members || []);
    } catch {
      // ignore
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
          icon: <Trash2 className="w-3.5 h-3.5" />,
          variant: 'danger' as const,
          onClick: handleBulkDeleteAdmins,
        },
      ]
    : [];

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-sky-400" />
          <span>Pengaturan & Profil</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Kelola profil akun, ubah password, hak akses panitia, dan audit log AMS Computer Community
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'profile'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profil & Keamanan Saya</span>
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'team'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Tim Panitia & Akses</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'audit'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Log Sistem</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'system'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 glass-panel'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Info Sistem Cloudflare</span>
        </button>
      </div>

      {/* Tab 0: Profile & Security Management */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account Overview Card */}
          <div className="glass-panel-elevated rounded-3xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-sky-500/30 font-heading">
                {currentAdmin?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-white">{currentAdmin?.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{currentAdmin?.email}</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex justify-between items-center p-3 rounded-xl glass-panel">
                <span className="text-slate-400">Tingkat Akses:</span>
                <span className="px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold bg-sky-950/90 text-sky-400 border border-sky-800/50">
                  {currentAdmin?.role}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl glass-panel">
                <span className="text-slate-400">Status Akun:</span>
                <span className="text-emerald-400 font-bold capitalize">{currentAdmin?.status}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl glass-panel">
                <span className="text-slate-400">ID Admin:</span>
                <span className="font-mono text-[11px] text-slate-300 truncate max-w-[140px]">
                  {currentAdmin?.id}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-800/40 text-[11px] text-sky-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
              <span>
                Data akun tersimpan terenkripsi secara aman di database Cloudflare D1.
              </span>
            </div>
          </div>

          {/* Edit Profile & Password Form */}
          <div className="lg:col-span-2 glass-panel-elevated rounded-3xl p-6 border border-slate-800 space-y-5">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>Kelola Profil & Ganti Password</span>
            </h3>

            {profileSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-300 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Lengkap:
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email / Username:
                  </label>
                  <input
                    type="email"
                    required
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <p className="text-xs font-bold text-slate-200">
                  Ganti Password <span className="text-slate-500 font-normal">(Kosongkan jika tidak ingin mengubah)</span>
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password Saat Ini:
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password sekarang"
                      className="w-full px-4 py-2.5 pr-12 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Password Baru:
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full px-4 py-2.5 pr-12 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      >
                        {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Konfirmasi Password Baru:
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password baru"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/25 active:scale-95 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{profileSaving ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Profil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 1: Team Management */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Admin Form (Owner only) */}
          {currentAdmin?.role === 'owner' && (
            <div className="glass-panel-elevated rounded-3xl p-5 border border-slate-800 space-y-4">
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-sky-400" />
                  <span>Tambah Akun Panitia</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Pilih dari anggota universal aktif untuk diberikan hak akses akun tim.
                </p>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddAdminFromMember} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pilih Anggota Utama / Universal:
                  </label>
                  <select
                    required
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Pilih Anggota Aktif --</option>
                    {activeMembers
                      .filter((m) => !admins.some((a) => a.member_id === m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.external_id}) {m.division ? `[${m.division}]` : ''}
                        </option>
                      ))}
                  </select>
                  {activeMembers.filter((m) => !admins.some((a) => a.member_id === m.id)).length === 0 && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      Semua anggota aktif sudah terdaftar memiliki akun panitia.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role / Peran:</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="operator">Operator (Pos Scanner & Cek Event)</option>
                    <option value="admin">Admin (Kelola Anggota, Event, QR)</option>
                    <option value="auditor">Auditor (Read-Only Rekap & Laporan)</option>
                    <option value="owner">Owner (Hak Akses Penuh / Super Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password Awal <span className="text-slate-500 font-normal">(Min. 6 Karakter)</span>:
                  </label>
                  <input
                    type="password"
                    required
                    value={newPasswordAdmin}
                    onChange={(e) => setNewPasswordAdmin(e.target.value)}
                    placeholder="Contoh: Panitia123!"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{formLoading ? 'Memproses...' : 'Buat Akun Tim dari Anggota'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Admin List */}
          <div className={`${currentAdmin?.role === 'owner' ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-3`}>
            <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      {currentAdmin?.role === 'owner' && (
                        <th className="w-10 px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectableAdmins.length > 0 && selectedAdminIds.size === selectableAdmins.length}
                            onChange={handleToggleSelectAllAdmins}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                            title={selectedAdminIds.size === selectableAdmins.length ? 'Batalkan pilih semua' : 'Pilih semua'}
                          />
                        </th>
                      )}
                      <th className="px-4 py-3.5">Nama & Identitas</th>
                      <th className="px-4 py-3.5">Role</th>
                      <th className="px-4 py-3.5">Tipe Akun</th>
                      <th className="px-4 py-3.5">Status</th>
                      {currentAdmin?.role === 'owner' && <th className="px-4 py-3.5 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {admins.map((adm) => {
                      const isSelectable = adm.id !== currentAdmin?.id && !(adm.role === 'owner' && adm.member_id === null);
                      const isSelected = selectedAdminIds.has(adm.id);
                      return (
                        <tr
                          key={adm.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-sky-950/20 hover:bg-sky-950/30' : 'hover:bg-slate-900/40'
                          }`}
                        >
                          {currentAdmin?.role === 'owner' && (
                            <td className="w-10 px-4 py-3.5 text-center">
                              {isSelectable ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectAdmin(adm.id)}
                                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/40 cursor-pointer accent-sky-500"
                                />
                              ) : (
                                <span className="text-slate-600 text-xs">-</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3.5 font-sans">
                            <div className="font-semibold text-white">{adm.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{adm.email}</div>
                            {adm.member_division && (
                              <span className="text-[10px] text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
                                Divisi: {adm.member_division}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold border ${
                                adm.role === 'owner'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-800/50'
                                  : adm.role === 'admin'
                                  ? 'bg-sky-950/80 text-sky-400 border-sky-800/50'
                                  : adm.role === 'operator'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
                                  : 'bg-purple-950/80 text-purple-300 border-purple-800/50'
                              }`}
                            >
                              {adm.role}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-sans">
                            {adm.id === 'adm_owner_default' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                Default Master
                              </span>
                            ) : adm.member_id ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950/80 text-sky-300 border border-sky-800/50">
                                <QrCode className="w-3 h-3 text-sky-400" />
                                <span>QR Pass ({adm.member_external_id || 'Member'})</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                                Direct Account
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-sans">
                            <span
                              className={`font-semibold ${
                                adm.status === 'active' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {adm.status === 'active' ? '● Aktif' : '○ Nonaktif'}
                            </span>
                          </td>
                          {currentAdmin?.role === 'owner' && (
                            <td className="px-4 py-3.5 font-sans text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(adm)}
                                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-sky-600/30 text-slate-300 hover:text-sky-400 transition-colors"
                                  title="Edit Akun & Password"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {adm.id !== 'adm_owner_default' && adm.id !== currentAdmin.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAdmin(adm)}
                                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600/30 text-slate-300 hover:text-rose-400 transition-colors"
                                    title="Hapus Akun Panitia"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

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
          </div>

          {/* Edit Admin Modal */}
          {editingAdmin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-sky-400" />
                    <h3 className="font-heading font-bold text-base text-white">
                      Edit Akun Panitia
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingAdmin(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="font-semibold text-white">{editingAdmin.name}</div>
                  <div className="text-slate-400 font-mono">{editingAdmin.email}</div>
                  {editingAdmin.member_external_id && (
                    <div className="text-sky-400 font-mono text-[11px]">
                      Kode Anggota: {editingAdmin.member_external_id}
                    </div>
                  )}
                </div>

                {editError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
                    {editError}
                  </div>
                )}

                <form onSubmit={handleSaveEditAdmin} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Role / Peran:</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="operator">Operator (Pos Scanner & Cek Event)</option>
                      <option value="admin">Admin (Kelola Anggota, Event, QR)</option>
                      <option value="auditor">Auditor (Read-Only Rekap & Laporan)</option>
                      <option value="owner">Owner (Hak Akses Penuh / Super Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Status Akun:</label>
                    <select
                      disabled={editingAdmin.id === 'adm_owner_default'}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500 disabled:opacity-50"
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif (Akses Dicabut)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Reset Password Baru <span className="text-slate-500 font-normal">(Kosongkan jika tidak diubah)</span>:
                    </label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingAdmin(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-lg shadow-sky-500/20"
                    >
                      {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Role-Based Access Control Matrix Card */}
          <div className="lg:col-span-3 glass-panel-elevated rounded-3xl p-6 border border-slate-800 space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span>Panduan & Matriks Hak Akses Setiap Role (RBAC Matrix)</span>
              </h3>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Sistem Keamanan Terpadu AMS Computer Community
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Owner */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-amber-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                    👑 Owner
                  </span>
                  <span className="text-[11px] text-amber-400/90 font-semibold">Super Admin</span>
                </div>
                <p className="text-xs text-slate-300">
                  Pemilik sistem dengan hak akses 100% penuh atas seluruh fitur dan data.
                </p>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800">
                  <p className="text-emerald-400 font-semibold">✓ Kelola Tim Panitia & Role</p>
                  <p className="text-emerald-400 font-semibold">✓ Kelola Anggota, Event, QR</p>
                  <p className="text-emerald-400 font-semibold">✓ Scan & Export Semua Laporan</p>
                </div>
              </div>

              {/* Admin */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-sky-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold bg-sky-950/80 text-sky-400 border border-sky-800/60 font-mono">
                    🛠️ Admin
                  </span>
                  <span className="text-[11px] text-sky-400/90 font-semibold">Pengelola</span>
                </div>
                <p className="text-xs text-slate-300">
                  Pengelola operasional data master anggota, event kegiatan, dan tiket QR.
                </p>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800">
                  <p className="text-emerald-400 font-semibold">✓ Tambah/Edit Anggota & Event</p>
                  <p className="text-emerald-400 font-semibold">✓ Generate QR & Cetak Badge</p>
                  <p className="text-rose-400/90">✗ Tidak bisa tambah panitia baru</p>
                </div>
              </div>

              {/* Operator */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-emerald-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono">
                    📱 Operator
                  </span>
                  <span className="text-[11px] text-emerald-400/90 font-semibold">Pos Scanner</span>
                </div>
                <p className="text-xs text-slate-300">
                  Petugas lapangan yang difokuskan untuk memindai presensi QR di pos kedatangan.
                </p>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800">
                  <p className="text-emerald-400 font-semibold">✓ Scan QR Kamera & Manual</p>
                  <p className="text-slate-400">✓ Lihat info Anggota & Event</p>
                  <p className="text-rose-400/90">✗ Tidak bisa ubah/hapus data</p>
                </div>
              </div>

              {/* Auditor */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-purple-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60 font-mono">
                    📊 Auditor
                  </span>
                  <span className="text-[11px] text-purple-400/90 font-semibold">Peninjau</span>
                </div>
                <p className="text-xs text-slate-300">
                  Peninjau independen untuk audit rekapitulasi presensi dan audit log sistem.
                </p>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800">
                  <p className="text-emerald-400 font-semibold">✓ Lihat Audit Log Sistem</p>
                  <p className="text-emerald-400 font-semibold">✓ Export Laporan CSV Rekap</p>
                  <p className="text-rose-400/90">✗ Read-Only (Tidak bisa scan)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Waktu</th>
                  <th className="px-5 py-3.5">Aksi</th>
                  <th className="px-5 py-3.5">Pelaksana</th>
                  <th className="px-5 py-3.5">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-sky-400">{log.action}</td>
                    <td className="px-5 py-3.5 font-sans text-slate-200">
                      {log.admin_name || log.admin_email || 'Sistem / Dev'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 truncate max-w-xs">
                      {typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: System Status */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel-elevated rounded-3xl p-6 border border-slate-800 space-y-4">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-sky-400" />
              <span>Arsitektur Kriptografi QR</span>
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between p-3 rounded-xl glass-panel">
                <span>Standard Enkripsi:</span>
                <span className="font-mono font-bold text-sky-400">JWE Compact (AES-256-GCM)</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl glass-panel">
                <span>Algorithm Header:</span>
                <span className="font-mono font-bold text-white">alg: dir, enc: A256GCM</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl glass-panel">
                <span>Active Key ID:</span>
                <span className="font-mono font-bold text-emerald-400">k1 (Rotatable)</span>
              </div>
            </div>
          </div>

          <div className="glass-panel-elevated rounded-3xl p-6 border border-slate-800 space-y-4">
            <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              <span>Cloudflare Serverless Stack</span>
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between p-3 rounded-xl glass-panel">
                <span>Backend Framework:</span>
                <span className="font-bold text-white">Hono on Cloudflare Workers</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl glass-panel">
                <span>Database:</span>
                <span className="font-bold text-sky-400">Cloudflare D1 (Dev / Local)</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl glass-panel">
                <span>Rate Limit & Cache:</span>
                <span className="font-bold text-emerald-400">Cloudflare KV Namespace</span>
              </div>
            </div>
          </div>
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
              <strong className="text-white">"{deletingAdmin.name}"</strong> ({deletingAdmin.email})?
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
