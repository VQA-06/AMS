import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Event, Member } from '../src/shared/types';

vi.mock('../src/client/components/ui/ModalPortal', () => ({
  ModalPortal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal-portal">{children}</div>,
}));

// Import components after mocking ModalPortal
import { EventFormModal } from '../src/client/components/events/EventFormModal';
import { MemberFormModal } from '../src/client/components/members/MemberFormModal';
import { GuestPassModal } from '../src/client/components/events/GuestPassModal';

const mockEvent: Event = {
  id: 'ev-test-1',
  name: 'Seminar Antariksa 2026',
  description: 'Seminar riset teknologi luar angkasa',
  location_name: 'Auditorium Utama',
  starts_at: '2026-05-01T08:00:00.000Z',
  ends_at: '2026-05-01T17:00:00.000Z',
  qr_policy: 'universal_allowed',
  status: 'active',
  session_modes: '["CHECKIN","CHECKOUT"]',
  allow_manual_attendance: 1,
  grace_minutes: 45,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const mockMember: Member = {
  id: 'mem-test-1',
  external_id: 'MBR-987654',
  name: 'Budi Santoso',
  division: 'Teknologi',
  group_name: 'Core Team',
  email: 'budi@example.com',
  phone: '08123456789',
  status: 'active',
  metadata: {},
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('Modal Form Submissions & HTML Form Tree Integrity', () => {
  describe('EventFormModal', () => {
    it('renders with modal surface as <form> containing submit button in footer', () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      const html = renderToString(
        <EventFormModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          event={mockEvent}
        />
      );

      // Verify outer modal surface is a form
      expect(html).toContain('<form');
      // Verify there is only one form (no nested forms)
      const formMatches = html.match(/<form/g);
      expect(formMatches?.length).toBe(1);

      // Verify submit button exists inside the rendered HTML
      expect(html).toContain('type="submit"');
      expect(html).toContain('Simpan Kegiatan');

      // Verify form closing tag is after the submit button
      const submitBtnIndex = html.indexOf('Simpan Kegiatan');
      const formCloseIndex = html.lastIndexOf('</form>');
      expect(formCloseIndex).toBeGreaterThan(submitBtnIndex);

      // Verify edit header is rendered
      expect(html).toContain('Edit Kegiatan / Event');
      expect(html).toContain('Nama Kegiatan');
      expect(html).toContain('Lokasi / Ruangan');

      // Verify scrollable body has no-scrollbar utility class
      expect(html).toContain('no-scrollbar flex-1 space-y-3 overflow-y-auto');
    });

    it('returns null when closed', () => {
      const html = renderToString(
        <EventFormModal
          isOpen={false}
          onClose={() => {}}
          onSave={async () => {}}
        />
      );
      expect(html).toBe('');
    });
  });

  describe('MemberFormModal', () => {
    it('renders with modal surface as <form> containing sticky submit button in footer', () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      const html = renderToString(
        <MemberFormModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          member={mockMember}
          divisionList={['Teknologi', 'Operasional']}
          groupList={['Core Team', 'Volunteer']}
        />
      );

      // Verify single outer form
      const formMatches = html.match(/<form/g);
      expect(formMatches?.length).toBe(1);

      // Verify submit button is present
      expect(html).toContain('type="submit"');
      expect(html).toContain('Simpan Data');

      // Verify submit button is within the form
      const submitBtnIndex = html.indexOf('Simpan Data');
      const formCloseIndex = html.lastIndexOf('</form>');
      expect(formCloseIndex).toBeGreaterThan(submitBtnIndex);

      // Verify edit header rendered
      expect(html).toContain('Edit Data Anggota');
      expect(html).toContain('ID / Kode Anggota');
      expect(html).toContain('Nama Lengkap');

      // Verify scrollable body has no-scrollbar utility class
      expect(html).toContain('no-scrollbar flex-1 space-y-3 overflow-y-auto');
    });

    it('renders correctly in create mode with empty member', () => {
      const html = renderToString(
        <MemberFormModal
          isOpen={true}
          onClose={() => {}}
          onSave={async () => {}}
        />
      );

      expect(html).toContain('Tambah Anggota Baru');
      expect(html).toContain('type="submit"');
      expect(html).toContain('Simpan Data');
    });
  });

  describe('GuestPassModal', () => {
    it('renders with modal surface as <form> containing submit button in footer', () => {
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      const html = renderToString(
        <GuestPassModal
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          event={mockEvent}
        />
      );

      // Verify single outer form
      const formMatches = html.match(/<form/g);
      expect(formMatches?.length).toBe(1);

      // Verify submit button is present
      expect(html).toContain('type="submit"');
      expect(html).toContain('Buat Tiket QR Tamu');

      // Verify submit button is within the form
      const submitBtnIndex = html.indexOf('Buat Tiket QR Tamu');
      const formCloseIndex = html.lastIndexOf('</form>');
      expect(formCloseIndex).toBeGreaterThan(submitBtnIndex);

      // Verify mode selectors
      expect(html).toContain('Daftar Nama');
      expect(html).toContain('Nomor Tiket');
      expect(html).toContain('Kegiatan Lalu');

      // Verify scrollable body has no-scrollbar utility class
      expect(html).toContain('no-scrollbar flex-1 space-y-3 overflow-y-auto');
    });
  });
});
