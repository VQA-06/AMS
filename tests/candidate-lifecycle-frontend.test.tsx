import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Member, MemberActivityEntry, MemberActivitySummary, MemberStatsSummary } from '../src/shared/types';

vi.mock('../src/client/components/ui/ModalPortal', () => ({
  ModalPortal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal-portal">{children}</div>,
}));

vi.mock('../src/client/hooks/useAuth', () => ({
  useAuth: () => ({
    admin: { id: 'admin-1', username: 'superadmin', role: 'owner', name: 'Super Admin' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { CandidateInductionModal } from '../src/client/components/members/CandidateInductionModal';
import { CandidateWorkspace } from '../src/client/components/members/CandidateWorkspace';
import { MemberList } from '../src/client/components/members/MemberList';
import { MemberFormModal } from '../src/client/components/members/MemberFormModal';
import { MembersPage } from '../src/client/pages/MembersPage';
import { MemberTrackerPage } from '../src/client/pages/MemberTrackerPage';
import { DashboardPage } from '../src/client/pages/DashboardPage';
const mockCandidates: Member[] = [
  {
    id: 'cand-1',
    external_id: 'CAN-001',
    name: 'Ahmad Fauzi',
    division: 'IT Development',
    group_name: 'Angkatan 2026',
    email: 'ahmad@example.com',
    phone: '081234567890',
    status: 'candidate',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cand-2',
    external_id: 'CAN-002',
    name: 'Siti Rahma',
    division: 'Media & Publikasi',
    group_name: 'Angkatan 2026',
    email: 'siti@example.com',
    phone: '081234567891',
    status: 'candidate',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

const mockOfficialMembers: Member[] = [
  {
    id: 'mem-1',
    external_id: 'MBR-001',
    name: 'Budi Hartono',
    division: 'Inti',
    group_name: 'Pengurus',
    email: 'budi@example.com',
    phone: '081234567800',
    status: 'active',
    metadata: {},
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'mem-2',
    external_id: 'MBR-002',
    name: 'Dewi Lestari',
    division: 'Humas',
    group_name: 'Anggota',
    email: 'dewi@example.com',
    phone: '081234567801',
    status: 'inactive',
    metadata: {},
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
];

describe('Candidate Member Lifecycle & Induction Frontend Suite', () => {
  describe('CandidateInductionModal Component', () => {
    it('renders candidate preview list, division selection, cohort sweeping option, and impact summary', () => {
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      const html = renderToString(
        <CandidateInductionModal
          isOpen={true}
          onClose={onClose}
          selectedCandidates={mockCandidates}
          allCandidatesCount={5}
          divisionList={['IT Development', 'Media & Publikasi', 'Riset']}
          batchGroup="Angkatan 2026"
          onSuccess={onSuccess}
        />
      );

      // Verify header and core title
      expect(html).toContain('Pelantikan Calon Anggota');
      expect(html).toContain('Lantik calon anggota terpilih menjadi anggota aktif resmi');

      // Verify selected candidates list preview
      expect(html).toContain('Ahmad Fauzi');
      expect(html).toContain('CAN-001');
      expect(html).toContain('Siti Rahma');
      expect(html).toContain('CAN-002');
      expect(html).toContain('Calon Terpilih');

      // Verify division assignment control
      expect(html).toContain('Tetapkan Divisi Resmi (Opsional)');
      expect(html).toContain('Pertahankan Divisi Calon Saat Ini');
      expect(html).toContain('IT Development');

      // Verify cohort sweeping option
      expect(html).toContain('Arsipkan calon anggota yang tidak terpilih');
      expect(html).toContain('candidate-induction-modal-sweep');

      // Verify impact preview callout
      expect(html).toContain('Ringkasan Dampak Pelantikan:');
      expect(html).toContain('calon');
      expect(html).toContain('Anggota Aktif Resmi');

      // Verify action buttons
      expect(html).toContain('Batal');
      expect(html).toContain('Lantik &amp; Tetapkan Anggota');
    });

    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <CandidateInductionModal
          isOpen={false}
          onClose={vi.fn()}
          selectedCandidates={mockCandidates}
          onSuccess={vi.fn()}
        />
      );
      expect(html).toBe('');
    });
  });

  describe('CandidateWorkspace Component', () => {
    it('renders summary KPI tiles, sub-tabs, and search filter without division filter', () => {
      const html = renderToString(
        <CandidateWorkspace
          canManage={true}
          canExport={true}
          canGenerate={true}
          divisions={['IT', 'Humas']}
          groups={['Angkatan 2025', 'Angkatan 2026']}
          onViewPass={vi.fn()}
          onBulkPrint={vi.fn()}
          onOpenAddCandidate={vi.fn()}
          onOpenImportCandidate={vi.fn()}
          onEditCandidate={vi.fn()}
        />
      );

      // Verify summary KPI stat tiles
      expect(html).toContain('Total Calon');
      expect(html).toContain('Calon Aktif');
      expect(html).toContain('Calon Diarsipkan');

      // Verify sub-tabs
      expect(html).toContain('Calon Aktif');
      expect(html).toContain('Arsip Calon');

      // Verify filter fields on active tab: search only, NO division filter, NO angkatan filter
      expect(html).toContain('Cari Calon Anggota');
      expect(html).not.toContain('Filter Divisi');
      expect(html).not.toContain('Filter Angkatan');
    });
  });

  describe('MembersPage Header Actions & Stats', () => {
    it('renders official actions, 3-card stats, and tabs on official view', () => {
      const html = renderToString(<MembersPage onGenerateQrForMember={vi.fn()} />);
      expect(html).toContain('Manajemen Anggota');
      expect(html).toContain('Tambah Anggota');
      expect(html).toContain('Impor CSV / Excel');
      expect(html).toContain('Cetak Semua Badge / PDF');
      expect(html).toContain('Ekspor CSV');

      // Verify 3-card KPI summary grid on official view
      expect(html).toContain('Total Anggota');
      expect(html).toContain('Anggota Aktif');
      expect(html).toContain('Anggota Nonaktif');

      // Verify main tabs
      expect(html).toContain('Anggota Resmi');
      expect(html).toContain('Calon Anggota &amp; Pelantikan');
    });
  });

  describe('MemberFormModal Dynamic Headings & Subtitles', () => {
    it('renders candidate-specific title and subtitle when creating candidate', () => {
      const html = renderToString(
        <MemberFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          defaultStatus="candidate"
        />
      );
      expect(html).toContain('Tambah Calon Anggota Baru');
      expect(html).toContain('Daftarkan calon anggota untuk pelacakan kegiatan');
    });

    it('renders official member title and subtitle when creating official member', () => {
      const html = renderToString(
        <MemberFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          defaultStatus="active"
        />
      );
      expect(html).toContain('Tambah Anggota Baru');
      expect(html).toContain('ID dibuat otomatis, divisi &amp; grup opsional');
    });

    it('renders candidate-specific title when editing a candidate member', () => {
      const html = renderToString(
        <MemberFormModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          member={mockCandidates[0]}
        />
      );
      expect(html).toContain('Edit Data Calon Anggota');
      expect(html).toContain('Perbarui profil anggota');
    });
  });
  describe('Official Member List Integrity', () => {
    it('strictly renders official members with Aktif and Nonaktif statuses', () => {
      const html = renderToString(
        <MemberList
          members={mockOfficialMembers}
          canManage={true}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onViewPass={vi.fn()}
        />
      );

      expect(html).toContain('Budi Hartono');
      expect(html).toContain('Dewi Lestari');
      expect(html).toContain('Aktif');
      expect(html).toContain('Nonaktif');
      // Should NOT contain candidate or archived labels in official list
      expect(html).not.toContain('Calon Anggota');
      expect(html).not.toContain('Diarsipkan');
    });
  });

  describe('MemberTrackerPage View Switcher & Candidate Tracking', () => {
    it('renders top-level view switch between Anggota Resmi and Calon Anggota', () => {
      const html = renderToString(<MemberTrackerPage />);

      expect(html).toContain('Pelacakan Keaktifan Anggota');
      expect(html).toContain('Anggota Resmi');
      expect(html).toContain('Calon Anggota');
      expect(html).toContain('Rata-Rata Kehadiran');
    });
  });

  describe('DashboardPage Member Stats with Candidates', () => {
    it('renders dashboard with candidate hint when candidates are registered', () => {
      const html = renderToString(
        <DashboardPage
          onNavigate={vi.fn()}
          onOpenAddMember={vi.fn()}
          onOpenCreateEvent={vi.fn()}
        />
      );

      expect(html).toContain('Ringkasan Operasional &amp; Kehadiran');
      expect(html).toContain('Total Anggota');
      expect(html).toContain('Kegiatan Aktif');
      expect(html).toContain('Buka Scanner QR');
    });
  });
});
