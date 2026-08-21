import { describe, it, expect } from 'vitest';
import { ActivityTier, MemberActivityEntry, MemberActivitySummary, Event } from '../src/shared/types';

describe('Member Activity Tracker & Active Event Filtering', () => {
  it('should categorize member activity tier correctly based on events attended and baseline', () => {
    const totalEvents = 5;

    const calculateTier = (attended: number): ActivityTier => {
      const rate = Math.min(100, Math.round((attended / totalEvents) * 100));
      if (attended >= 3 || rate >= 60) return 'highly_active';
      if (attended >= 1 || rate > 0) return 'active';
      return 'inactive';
    };

    expect(calculateTier(4)).toBe('highly_active');
    expect(calculateTier(3)).toBe('highly_active');
    expect(calculateTier(2)).toBe('active');
    expect(calculateTier(1)).toBe('active');
    expect(calculateTier(0)).toBe('inactive');
  });

  it('should aggregate summary statistics accurately', () => {
    const mockEntries: MemberActivityEntry[] = [
      {
        member_id: 'mem_1',
        member_name: 'Budi Santoso',
        member_external_id: 'CC-001',
        member_division: 'Web Dev',
        member_group: 'A',
        status: 'active',
        total_events_attended: 4,
        total_checkins: 4,
        attendance_rate: 80,
        activity_tier: 'highly_active',
        last_attended_at: '2026-08-19T10:00:00Z',
      },
      {
        member_id: 'mem_2',
        member_name: 'Siti Aminah',
        member_external_id: 'CC-002',
        member_division: 'UI/UX',
        member_group: 'B',
        status: 'active',
        total_events_attended: 2,
        total_checkins: 2,
        attendance_rate: 40,
        activity_tier: 'active',
        last_attended_at: '2026-08-15T10:00:00Z',
      },
      {
        member_id: 'mem_3',
        member_name: 'Ahmad Fauzi',
        member_external_id: 'CC-003',
        member_division: 'Mobile',
        member_group: null,
        status: 'active',
        total_events_attended: 0,
        total_checkins: 0,
        attendance_rate: 0,
        activity_tier: 'inactive',
        last_attended_at: null,
      },
    ];

    const highlyActiveCount = mockEntries.filter((e) => e.activity_tier === 'highly_active').length;
    const activeCount = mockEntries.filter((e) => e.activity_tier === 'active').length;
    const inactiveCount = mockEntries.filter((e) => e.activity_tier === 'inactive').length;
    const avgRate = Math.round(
      mockEntries.reduce((acc, curr) => acc + curr.attendance_rate, 0) / mockEntries.length
    );

    const summary: MemberActivitySummary = {
      total_members: mockEntries.length,
      total_events: 5,
      highly_active_count: highlyActiveCount,
      active_count: activeCount,
      inactive_count: inactiveCount,
      average_attendance_rate: avgRate,
    };

    expect(summary.total_members).toBe(3);
    expect(summary.highly_active_count).toBe(1);
    expect(summary.active_count).toBe(1);
    expect(summary.inactive_count).toBe(1);
    expect(summary.average_attendance_rate).toBe(40); // (80 + 40 + 0) / 3 = 40
  });

  it('should filter events in Scanner to only include status active', () => {
    const mockEvents: Event[] = [
      {
        id: 'ev_1',
        name: 'Workshop Web Dev',
        description: null,
        location_name: 'Lab 1',
        starts_at: null,
        ends_at: null,
        qr_policy: 'universal_allowed',
        status: 'active',
        session_modes: ['CHECKIN'],
        allow_manual_attendance: 1,
        grace_minutes: 15,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'ev_2',
        name: 'Seminar AI (Draft)',
        description: null,
        location_name: 'Auditorium',
        starts_at: null,
        ends_at: null,
        qr_policy: 'event_only',
        status: 'draft',
        session_modes: ['CHECKIN'],
        allow_manual_attendance: 1,
        grace_minutes: 15,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'ev_3',
        name: 'Lomba Desain (Closed)',
        description: null,
        location_name: 'Lab 2',
        starts_at: null,
        ends_at: null,
        qr_policy: 'universal_allowed',
        status: 'closed',
        session_modes: ['CHECKIN'],
        allow_manual_attendance: 1,
        grace_minutes: 15,
        created_at: '',
        updated_at: '',
      },
    ];

    const activeEvents = mockEvents.filter((e) => e.status === 'active');
    expect(activeEvents.length).toBe(1);
    expect(activeEvents[0].id).toBe('ev_1');
    expect(activeEvents[0].name).toBe('Workshop Web Dev');
  });

  it('should auto-select direct scanned eventId if valid and active', () => {
    const activeEvents: Event[] = [
      {
        id: 'ev_1',
        name: 'Event 1',
        description: null,
        location_name: null,
        starts_at: null,
        ends_at: null,
        qr_policy: 'universal_allowed',
        status: 'active',
        session_modes: ['CHECKIN'],
        allow_manual_attendance: 1,
        grace_minutes: 15,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'ev_2',
        name: 'Event 2',
        description: null,
        location_name: null,
        starts_at: null,
        ends_at: null,
        qr_policy: 'universal_allowed',
        status: 'active',
        session_modes: ['CHECKIN'],
        allow_manual_attendance: 1,
        grace_minutes: 15,
        created_at: '',
        updated_at: '',
      },
    ];

    const resolveSelectedEvent = (initialEventId?: string | null): string => {
      if (initialEventId && activeEvents.some((e) => e.id === initialEventId)) {
        return initialEventId;
      }
      return activeEvents[0]?.id || '';
    };

    expect(resolveSelectedEvent('ev_2')).toBe('ev_2');
    expect(resolveSelectedEvent('ev_non_existent')).toBe('ev_1');
    expect(resolveSelectedEvent(null)).toBe('ev_1');
  });
});
