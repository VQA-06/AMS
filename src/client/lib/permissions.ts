import { Role } from '@/shared/types';

/**
 * Role-Based Access Control (RBAC) Permission Helpers
 */

export const canManageAdmins = (role?: Role | null): boolean => {
  return role === 'owner';
};

export const canManageMembers = (role?: Role | null): boolean => {
  return role === 'owner' || role === 'admin';
};

export const canManageEvents = (role?: Role | null): boolean => {
  return role === 'owner' || role === 'admin';
};

export const canGenerateQR = (role?: Role | null): boolean => {
  return role === 'owner' || role === 'admin';
};

export const canScanQR = (role?: Role | null): boolean => {
  return role === 'owner' || role === 'admin' || role === 'operator';
};

export const canViewAudit = (role?: Role | null): boolean => {
  return role === 'owner' || role === 'admin' || role === 'auditor';
};

export const canExportData = (role?: Role | null): boolean => {
  return role === 'owner' || role === 'admin' || role === 'auditor';
};

export interface RoleBadgeInfo {
  label: string;
  badgeClass: string;
  description: string;
}

export const getRoleInfo = (role?: Role | null): RoleBadgeInfo => {
  switch (role) {
    case 'owner':
      return {
        label: 'Owner',
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        description: 'Pemilik Sistem (Akses Penuh + Kelola Panitia)',
      };
    case 'admin':
      return {
        label: 'Admin',
        badgeClass: 'bg-sky-950/80 text-sky-400 border-sky-800/60',
        description: 'Administrator (Kelola Anggota, Event & QR)',
      };
    case 'operator':
      return {
        label: 'Operator',
        badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
        description: 'Petugas Lapangan (Fokus Scan Presensi)',
      };
    case 'auditor':
      return {
        label: 'Auditor',
        badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
        description: 'Peninjau Independen (Read-Only & Rekap Laporan)',
      };
    default:
      return {
        label: 'Panitia',
        badgeClass: 'bg-slate-900 text-slate-400 border-slate-700',
        description: 'Pengguna Sistem',
      };
  }
};
