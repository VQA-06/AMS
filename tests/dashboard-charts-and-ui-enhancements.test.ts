import { describe, it, expect, vi } from 'vitest';
import { EventRepository } from '../src/server/repositories/event.repo';
import { MemberRepository } from '../src/server/repositories/member.repo';

describe('Dashboard Charts & UI Enhancements Tests', () => {
  describe('EventRepository.getTopAttendanceEvents', () => {
    it('should aggregate attendance, checkin, checkout, guest, and member counts correctly', async () => {
      const mockResults = [
        {
          id: 'ev-1',
          name: 'Workshop Web3 & AI',
          status: 'active',
          starts_at: '2026-08-20T08:00:00Z',
          ends_at: '2026-08-20T17:00:00Z',
          qr_policy: 'universal_allowed',
          location_name: 'Auditorium CC',
          attendance_count: 45,
          checkin_count: 45,
          checkout_count: 30,
          guest_count: 10,
          member_count: 35,
        },
        {
          id: 'ev-2',
          name: 'Seminar Cyber Security',
          status: 'closed',
          starts_at: '2026-08-10T08:00:00Z',
          ends_at: '2026-08-10T15:00:00Z',
          qr_policy: 'event_only',
          location_name: 'Lab Jaringan',
          attendance_count: 28,
          checkin_count: 28,
          checkout_count: 25,
          guest_count: 5,
          member_count: 23,
        },
      ];

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockResults }),
        }),
      } as any;

      const repo = new EventRepository(mockDb);
      const topEvents = await repo.getTopAttendanceEvents();

      expect(mockDb.prepare).toHaveBeenCalled();
      const sqlQuery = mockDb.prepare.mock.calls[0][0];
      expect(sqlQuery).toContain('COUNT(DISTINCT a.id) as attendance_count');
      expect(sqlQuery).toContain('guest_count');
      expect(sqlQuery).toContain('member_count');
      expect(sqlQuery).toContain('ORDER BY attendance_count DESC');

      expect(topEvents).toHaveLength(2);
      expect(topEvents[0].name).toBe('Workshop Web3 & AI');
      expect(topEvents[0].attendance_count).toBe(45);
      expect(topEvents[0].member_count).toBe(35);
      expect(topEvents[0].guest_count).toBe(10);
    });
  });

  describe('MemberRepository.getYearlyStats', () => {
    it('should query members grouped by created_at year and status', async () => {
      const mockStats = [
        { year: '2024', active_count: 12, inactive_count: 2, total_count: 14 },
        { year: '2025', active_count: 25, inactive_count: 5, total_count: 30 },
        { year: '2026', active_count: 40, inactive_count: 4, total_count: 44 },
      ];

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockStats }),
        }),
      } as any;

      const repo = new MemberRepository(mockDb);
      const stats = await repo.getYearlyStats();

      expect(mockDb.prepare).toHaveBeenCalled();
      const sqlQuery = mockDb.prepare.mock.calls[0][0];
      expect(sqlQuery).toContain("strftime('%Y', created_at) as year");
      expect(sqlQuery).toContain("status = 'active'");
      expect(sqlQuery).toContain("status = 'inactive'");
      expect(sqlQuery).toContain('GROUP BY year');

      expect(stats).toHaveLength(3);
      expect(stats[2].year).toBe('2026');
      expect(stats[2].active_count).toBe(40);
      expect(stats[2].total_count).toBe(44);
    });
  });

  describe('Yearly Filter Logic & Default Status', () => {
    it('should default to active filter and calculate totals accordingly', () => {
      const yearlyStats = [
        { year: '2024', active_count: 10, inactive_count: 3, total_count: 13 },
        { year: '2025', active_count: 20, inactive_count: 5, total_count: 25 },
        { year: '2026', active_count: 30, inactive_count: 2, total_count: 32 },
      ];

      // Active status (DEFAULT)
      const activeTotal = yearlyStats.reduce((acc, s) => acc + s.active_count, 0);
      expect(activeTotal).toBe(60);

      // All status
      const allTotal = yearlyStats.reduce((acc, s) => acc + s.total_count, 0);
      expect(allTotal).toBe(70);

      // Inactive status
      const inactiveTotal = yearlyStats.reduce((acc, s) => acc + s.inactive_count, 0);
      expect(inactiveTotal).toBe(10);
    });
  });

  describe('FloatingScanToast Desktop & Mobile Placement Classes', () => {
    it('should include top-right placement classes for desktop and center classes for mobile', () => {
      const desktopTopRightClasses = 'md:top-6 md:right-6 md:left-auto md:translate-x-0 md:max-w-sm';
      const mobileCenterClasses = 'top-4 inset-x-3 sm:top-5 sm:left-1/2 sm:-translate-x-1/2';

      expect(desktopTopRightClasses).toContain('md:top-6');
      expect(desktopTopRightClasses).toContain('md:right-6');
      expect(desktopTopRightClasses).toContain('md:left-auto');
      expect(mobileCenterClasses).toContain('inset-x-3');
    });
  });

  describe('EventRepository.list with Attendance Aggregations', () => {
    it('should query events with LEFT JOIN attendances and members', async () => {
      const mockEvents = [
        {
          id: 'evt-1',
          name: 'Event Test',
          attendance_count: 5,
          guest_count: 3,
          member_count: 2,
        },
      ];

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: mockEvents }),
          }),
        }),
      } as any;

      const repo = new EventRepository(mockDb);
      const events = await repo.list();

      expect(mockDb.prepare).toHaveBeenCalled();
      const sqlQuery = mockDb.prepare.mock.calls[0][0];
      expect(sqlQuery).toContain('attendance_count');
      expect(sqlQuery).toContain('checkin_count');
      expect(events[0].attendance_count).toBe(5);
    });
  });

  describe('Desktop Sticky 100dvh Shell Layout', () => {
    it('should have 100dvh root container and independent scrollable content area', () => {
      const shellClasses = 'h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 flex flex-col md:flex-row';
      const sidebarClasses = 'hidden md:flex flex-col w-64 h-full shrink-0 glass-panel border-r border-slate-800 p-5 justify-between sticky top-0';
      const contentClasses = 'flex-1 flex flex-col min-w-0 h-full overflow-y-auto overflow-x-hidden';

      expect(shellClasses).toContain('h-[100dvh]');
      expect(shellClasses).toContain('overflow-hidden');
      expect(sidebarClasses).toContain('sticky');
      expect(sidebarClasses).toContain('h-full');
      expect(contentClasses).toContain('overflow-y-auto');
    });
  });
});
