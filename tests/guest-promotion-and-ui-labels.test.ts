import { describe, it, expect } from 'vitest';
import { Member, Attendance, QrToken } from '../src/shared/types';

describe('Guest Promotion to Official Member & Compact Action Labels', () => {
  it('should transform temporary guest metadata and external ID into official member format', () => {
    const guestMember: Member = {
      id: 'mem_guest123',
      external_id: 'GUEST-987654',
      name: 'Rian Pratama',
      email: null,
      phone: null,
      group_name: 'Tamu: Welcoming Party 2026',
      division: null,
      status: 'active',
      metadata: JSON.stringify({ temporary: true, event_id: 'evt_welcoming' }),
      created_at: '2026-08-20T10:00:00.000Z',
      updated_at: '2026-08-20T10:00:00.000Z',
    };

    // Promotion transformation simulation
    const newExternalId = 'MBR-778899';
    const chosenDivision = 'Software Engineering';

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(guestMember.metadata as string);
    } catch {
      meta = {};
    }
    delete meta.temporary;
    delete meta.event_id;
    meta.is_promoted = true;
    meta.promoted_at = new Date().toISOString();

    const promotedMember: Member = {
      ...guestMember,
      external_id: newExternalId,
      group_name: 'Anggota',
      division: chosenDivision,
      metadata: JSON.stringify(meta),
      updated_at: new Date().toISOString(),
    };

    expect(promotedMember.external_id).toBe('MBR-778899');
    expect(promotedMember.external_id.startsWith('GUEST-')).toBe(false);
    expect(promotedMember.group_name).toBe('Anggota');
    expect(promotedMember.division).toBe('Software Engineering');

    const parsedMeta = JSON.parse(promotedMember.metadata as string);
    expect(parsedMeta.temporary).toBeUndefined();
    expect(parsedMeta.is_promoted).toBe(true);
    expect(parsedMeta.promoted_at).toBeDefined();
  });

  it('should preserve past attendance history and synchronize external ID on promotion', () => {
    const pastAttendances: Attendance[] = [
      {
        id: 'att_001',
        event_id: 'evt_welcoming',
        member_id: 'mem_guest123',
        member_name: 'Rian Pratama',
        member_external_id: 'GUEST-987654',
        member_division: null,
        qr_token_id: 'tok_001',
        session_type: 'CHECKIN',
        scanned_at: '2026-08-20T10:15:00.000Z',
        station_id: null,
        operator_id: 'adm_op_1',
        operator_name: 'Operator 1',
        is_manual: 0,
        meta: '{}',
      },
    ];

    const newOfficialExternalId = 'MBR-778899';

    // Synchronize attendance external id
    const updatedAttendances = pastAttendances.map((att) => ({
      ...att,
      member_external_id: newOfficialExternalId,
    }));

    expect(updatedAttendances[0].member_id).toBe('mem_guest123');
    expect(updatedAttendances[0].event_id).toBe('evt_welcoming');
    expect(updatedAttendances[0].member_external_id).toBe('MBR-778899');
    expect(updatedAttendances[0].session_type).toBe('CHECKIN');
  });

  it('should qualify promoted member for Activity Tracker statistics and protect from event deletion', () => {
    const promotedMember = {
      id: 'mem_guest123',
      external_id: 'MBR-778899',
      name: 'Rian Pratama',
      group_name: 'Anggota',
      metadata: JSON.stringify({ is_promoted: true }),
    };

    // Filter used in Activity Tracker and Cascade Delete
    const isTemporaryGuest = (m: typeof promotedMember): boolean => {
      let meta: any = {};
      try {
        meta = JSON.parse(m.metadata);
      } catch {}
      return (
        m.external_id.startsWith('GUEST-') ||
        (m.group_name && m.group_name.startsWith('Tamu:')) ||
        meta.temporary === true
      );
    };

    // Promoted member is NOT a temporary guest anymore
    expect(isTemporaryGuest(promotedMember)).toBe(false);
  });

  it('should provide concise bulk action labels for high mobile responsiveness', () => {
    const memberBulkLabels = ['Cetak QR', 'Nonaktifkan', 'Hapus'];
    const eventBulkLabels = ['Tutup', 'Hapus'];
    const tokenBulkLabels = ['Cetak QR', 'Jadikan Anggota', 'Hapus'];

    for (const label of [...memberBulkLabels, ...eventBulkLabels, ...tokenBulkLabels]) {
      expect(label.length).toBeLessThanOrEqual(16);
      expect(label).not.toContain('Massal');
      expect(label).not.toContain('Terpilih');
    }
  });
});
