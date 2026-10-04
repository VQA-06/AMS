import React, { useEffect, useState } from 'react';
import { Warning } from '@phosphor-icons/react/Warning';
import { Admin, AuditLog, Member } from '@/shared/types';
import { fetchApi } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { AuditTab } from './settings/AuditTab';
import { ProfileTab } from './settings/ProfileTab';
import { SystemTab } from './settings/SystemTab';
import { TeamTab } from './settings/TeamTab';

type SettingsTab = 'profile' | 'team' | 'audit' | 'system';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'Profil & Keamanan Saya' },
  { id: 'team', label: 'Tim Panitia & Akses' },
  { id: 'audit', label: 'Audit Log Sistem' },
  { id: 'system', label: 'Info Sistem Cloudflare' },
];

/**
 * Shell only. Each tab owns its own state and handlers under `settings/*`; what
 * stays here is the three things they genuinely share — the fetched data, the
 * partial-error reporting, and the tab selection.
 *
 * The shell is deliberately not a skeleton registry: a tab that only rendered
 * `{activeTab === 'x' && <XTab/>}` needed one import and one branch, and the
 * data plumbing below is the real cost of that split.
 */
export const SettingsPage: React.FC = () => {
  const { admin: currentAdmin } = useAuth();

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [partialErrors, setPartialErrors] = useState<string[]>([]);

  const loadData = async () => {
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
    ) as [
      { admins: Admin[] } | null,
      { logs: AuditLog[] } | null,
      { members: Member[] } | null,
    ];

    setAdmins(admRes?.admins || []);
    setAuditLogs(logRes?.logs || []);
    setActiveMembers(memRes?.members || []);
  };

  useEffect(() => {
    loadData();
  }, []);

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
        items={TABS}
        active={activeTab}
        onChange={(id) => setActiveTab(id as SettingsTab)}
        variant="underline"
        ariaLabel="Bagian pengaturan"
      />

      {activeTab === 'profile' && (
        <ProfileTab currentAdmin={currentAdmin} onSaved={loadData} />
      )}

      {activeTab === 'team' && (
        <TeamTab
          currentAdmin={currentAdmin}
          admins={admins}
          activeMembers={activeMembers}
          partialErrors={partialErrors}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'audit' && <AuditTab logs={auditLogs} />}

      {activeTab === 'system' && <SystemTab />}
    </div>
  );
};