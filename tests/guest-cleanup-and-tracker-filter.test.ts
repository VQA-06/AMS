import { describe, it, expect } from 'vitest';
import { Member } from '../src/shared/types';

describe('Guest Cleanup & Activity Tracker Filtering', () => {
  it('should filter out temporary/guest members from the activity tracker list', () => {
    const mockDbMembers: Member[] = [
      {
        id: 'mem_1',
        external_id: 'CC-001',
        name: 'Ahmad Fauzi',
        email: 'ahmad@cc.org',
        phone: '08123456789',
        group_name: 'Core Team',
        division: 'Web Dev',
        status: 'active',
        metadata: '{}',
        created_at: '',
        updated_at: '',
      },
      {
        id: 'mem_2',
        external_id: 'GUEST-123456',
        name: 'Tamu Seminar 1',
        email: 'tamu1@gmail.com',
        phone: null,
        group_name: 'Tamu: Seminar AI',
        division: 'Umum',
        status: 'active',
        metadata: JSON.stringify({ temporary: true, event_id: 'ev_1' }),
        created_at: '',
        updated_at: '',
      },
      {
        id: 'mem_3',
        external_id: 'CC-002',
        name: 'Siti Aminah',
        email: 'siti@cc.org',
        phone: '08987654321',
        group_name: 'Anggota',
        division: 'UI/UX',
        status: 'active',
        metadata: '{}',
        created_at: '',
        updated_at: '',
      },
      {
        id: 'mem_4',
        external_id: 'GUEST-789012',
        name: 'Tamu Workshop 2',
        email: null,
        phone: null,
        group_name: 'Tamu: Workshop Web',
        division: null,
        status: 'active',
        metadata: JSON.stringify({ temporary: true, event_id: 'ev_2' }),
        created_at: '',
        updated_at: '',
      },
    ];

    // Filter rule applied in getMemberActivityStats
    const isGuestMember = (m: Member): boolean => {
      if (m.external_id.startsWith('GUEST-')) return true;
      if (m.group_name && m.group_name.startsWith('Tamu:')) return true;
      try {
        const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
        if (meta && meta.temporary === true) return true;
      } catch {
        // ignore JSON parse error
      }
      return false;
    };

    const regularMembers = mockDbMembers.filter((m) => !isGuestMember(m));

    expect(regularMembers.length).toBe(2);
    expect(regularMembers.map((m) => m.name)).toEqual(['Ahmad Fauzi', 'Siti Aminah']);
    expect(regularMembers.some((m) => m.external_id.startsWith('GUEST-'))).toBe(false);
  });

  it('should identify all guest members tied to a deleted event for cascade deletion', () => {
    const eventIdToDelete = 'ev_1';

    const mockMembers: Array<{
      id: string;
      external_id: string;
      group_name: string | null;
      metadata: Record<string, unknown>;
    }> = [
      {
        id: 'mem_guest_1',
        external_id: 'GUEST-111111',
        group_name: 'Tamu: Seminar AI',
        metadata: { temporary: true, event_id: 'ev_1' },
      },
      {
        id: 'mem_guest_2',
        external_id: 'GUEST-222222',
        group_name: 'Tamu: Workshop Flutter',
        metadata: { temporary: true, event_id: 'ev_2' },
      },
      {
        id: 'mem_regular',
        external_id: 'CC-001',
        group_name: 'Core Team',
        metadata: {},
      },
    ];

    const targetGuestIds = mockMembers
      .filter((m) => {
        const isTemporary =
          m.metadata.temporary === true ||
          m.external_id.startsWith('GUEST-') ||
          (m.group_name && m.group_name.startsWith('Tamu:'));
        const isLinkedToEvent = m.metadata.event_id === eventIdToDelete;
        return isTemporary && isLinkedToEvent;
      })
      .map((m) => m.id);

    expect(targetGuestIds).toEqual(['mem_guest_1']);
    expect(targetGuestIds).not.toContain('mem_regular');
    expect(targetGuestIds).not.toContain('mem_guest_2');
  });

  it('should accurately identify all guest members for global cleanup', () => {
    const allMembers: Array<{
      id: string;
      external_id: string;
      group_name: string | null;
      metadata: string;
    }> = [
      { id: '1', external_id: 'CC-001', group_name: 'Web Dev', metadata: '{}' },
      { id: '2', external_id: 'GUEST-1001', group_name: 'Tamu: Event A', metadata: '{"temporary":true}' },
      { id: '3', external_id: 'GUEST-1002', group_name: null, metadata: '{"temporary": true}' },
      { id: '4', external_id: 'CC-002', group_name: 'Mobile Dev', metadata: '{}' },
      { id: '5', external_id: 'TMP-001', group_name: 'Tamu: Workshop', metadata: '{}' },
    ];

    const isGuest = (m: (typeof allMembers)[0]) =>
      m.external_id.startsWith('GUEST-') ||
      (m.group_name && m.group_name.startsWith('Tamu:')) ||
      m.metadata.includes('"temporary":true') ||
      m.metadata.includes('"temporary": true');

    const guestIds = allMembers.filter(isGuest).map((m) => m.id);
    expect(guestIds).toEqual(['2', '3', '5']);
  });
});
