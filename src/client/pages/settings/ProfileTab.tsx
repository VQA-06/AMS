import React, { useEffect, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { LockKey } from '@phosphor-icons/react/LockKey';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { Admin } from '@/shared/types';
import { useAuth } from '../../hooks/useAuth';
import { getRoleInfo } from '../../lib/permissions';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';

interface ProfileTabProps {
  currentAdmin: Admin | null;
  /** Re-read the roster after a profile write so role/status stay truthful. */
  onSaved: () => Promise<void>;
}

/**
 * Owns every field of its own form. Nothing here is read by another tab, so
 * lifting this state into the page shell bought nothing but a 150-line prop list.
 */
export const ProfileTab: React.FC<ProfileTabProps> = ({ currentAdmin, onSaved }) => {
  const { updateProfile } = useAuth();

  const [profileName, setProfileName] = useState<string>(currentAdmin?.name || '');
  const [profileEmail, setProfileEmail] = useState<string>(currentAdmin?.email || '');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState<boolean>(false);

  // The auth context resolves asynchronously on first paint, so seeding the
  // form from it once would leave the fields blank until a manual refresh.
  useEffect(() => {
    setProfileName(currentAdmin?.name || '');
    setProfileEmail(currentAdmin?.email || '');
  }, [currentAdmin?.id, currentAdmin?.name, currentAdmin?.email]);

  const currentRoleInfo = getRoleInfo(currentAdmin?.role);

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
      await onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui profil.';
      setProfileErrorMsg(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  return (
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
              id="pages-settings-profiletab-field-1"
              label="Nama Lengkap:"
              control="text"
              required
              value={profileName}
              onChange={setProfileName}
              autoComplete="name"
            />

            <Field
              id="pages-settings-profiletab-field-2"
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
              Ganti Password{' '}
              <span className="font-normal text-ink-2">(Kosongkan jika tidak ingin mengubah)</span>
            </p>

            <Field
              id="pages-settings-profiletab-field-3"
              label="Password Saat Ini:"
              control="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Masukkan password sekarang"
              controlClassName="font-oxanium"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="pages-settings-profiletab-field-4"
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
                id="pages-settings-profiletab-field-5"
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
  );
};