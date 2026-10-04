import { Role } from '@/shared/types';
import type { BadgeVariant } from '../components/ui/Badge';

/**
 * Role-Based Access Control (RBAC) Permission Helpers
 */

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

export const canExportData = (role?: Role | null): boolean => {
  return role === 'owner' || role === 'admin' || role === 'auditor';
};

export interface RoleBadgeInfo {
  label: string;
  /** A palette token, not a class string: MobileShell renders a real Badge. */
  variant: BadgeVariant;
  description: string;
}

export const getRoleInfo = (role?: Role | null): RoleBadgeInfo => {
  switch (role) {
    case 'owner':
      return {
        label: 'Owner',
        variant: 'pen',
        description: 'Pemilik Sistem (Akses Penuh + Kelola Panitia)',
      };
    case 'admin':
      return {
        label: 'Admin',
        variant: 'info',
        description: 'Administrator (Kelola Anggota, Event & QR)',
      };
    case 'operator':
      return {
        label: 'Operator',
        variant: 'seal',
        description: 'Petugas Lapangan (Fokus Scan Presensi)',
      };
    case 'auditor':
      return {
        label: 'Auditor',
        variant: 'neutral',
        description: 'Peninjau Independen (Read-Only & Rekap Laporan)',
      };
    default:
      return {
        label: 'Panitia',
        variant: 'neutral',
        description: 'Pengguna Sistem',
      };
  }
};