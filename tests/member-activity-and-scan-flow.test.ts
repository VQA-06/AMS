import { describe, it, expect } from 'vitest';
import {
  AttendanceRepository,
  classifyActivityTier,
} from '../src/server/repositories/attendance.repo';
import { ActivityTier } from '../src/shared/types';

/**
 * Minimal D1 stand-in for `getMemberActivityStats`. `D1Database` is a wide
 * interface that cannot be satisfied structurally without reimplementing the
 * whole Workers surface, so the double is cast at that single boundary and
 * typed everywhere else.
 */
function mockActivityDb(rows: unknown[]): D1Database {
  // The baseline count is read via `.prepare().first()` with no bind, while
  // the aggregation goes through `.bind(...).all()`, so every method has to
  // exist on the statement both before and after bind.
  const statement = (sql: string, params: unknown[]) => ({
    sql,
    params,
    bind: (...bound: unknown[]) => statement(sql, bound),
    first: async () => ({ total_events: 5 }),
    all: async () => ({ results: rows }),
    run: async () => ({ success: true }),
  });
  return {
    prepare: (sql: string) => statement(sql, []),
    batch: async () => [],
  } as unknown as D1Database;
}

describe('Member Activity Tracker & Active Event Filtering', () => {
  it('should categorize member activity tier correctly based on events attended and baseline', () => {
    const TOTAL_EVENTS = 5;
    // Rate is computed exactly as getMemberActivityStats does it, then handed
    // to the production classifier.
    const rate = (attended: number) => Math.min(100, Math.round((attended / TOTAL_EVENTS) * 100));

    expect(classifyActivityTier(4, rate(4))).toBe('highly_active');
    expect(classifyActivityTier(3, rate(3))).toBe('highly_active');
    expect(classifyActivityTier(2, rate(2))).toBe('active');
    expect(classifyActivityTier(1, rate(1))).toBe('active');
    expect(classifyActivityTier(0, rate(0))).toBe('inactive');
  });

  it('should reach the highly_active tier on rate alone even with few attendances', () => {
    // The thresholds are OR'd, not cascaded: a member below the `attended >= 3`
    // cut can still qualify on rate. These cases are where the OR matters.
    expect(classifyActivityTier(0, 60)).toBe('highly_active');
    expect(classifyActivityTier(0, 59)).toBe('active');
    expect(classifyActivityTier(3, 0)).toBe('highly_active');
    // `rate > 0` is strict; a zero rate falls through to inactive.
    expect(classifyActivityTier(0, 0.4)).toBe('active');
    expect(classifyActivityTier(0, 0)).toBe('inactive');
  });

  it('should aggregate summary statistics accurately', async () => {
    // Row fixtures as the aggregation query returns them: attended counts of
    // 4 / 2 / 0 against a 5-event baseline.
    const rows = [
      { member_id: 'mem_1', member_name: 'Budi Santoso', member_external_id: 'CC-001', member_division: 'Web Dev', member_group: 'A', status: 'active', total_events_attended: 4, total_checkins: 4, last_attended_at: '2026-08-19T10:00:00Z' },
      { member_id: 'mem_2', member_name: 'Siti Aminah', member_external_id: 'CC-002', member_division: 'UI/UX', member_group: 'B', status: 'active', total_events_attended: 2, total_checkins: 2, last_attended_at: '2026-08-18T10:00:00Z' },
      { member_id: 'mem_3', member_name: 'Rina Wijaya', member_external_id: 'CC-003', member_division: null, member_group: null, status: 'active', total_events_attended: 0, total_checkins: 0, last_attended_at: null },
    ];

    const repo = new AttendanceRepository(mockActivityDb(rows));
    const { entries, summary } = await repo.getMemberActivityStats();

    expect(entries.map((e) => e.activity_tier)).toEqual([
      'highly_active',
      'active',
      'inactive',
    ]);
    expect(entries.map((e) => e.attendance_rate)).toEqual([80, 40, 0]);
    expect(entries.map((e) => e.total_events_attended)).toEqual([4, 2, 0]);

    expect(summary.total_members).toBe(3);
    expect(summary.total_events).toBe(5);
    expect(summary.highly_active_count).toBe(1);
    expect(summary.active_count).toBe(1);
    expect(summary.inactive_count).toBe(1);
    expect(summary.average_attendance_rate).toBe(40); // (80 + 40 + 0) / 3 = 40
  });

  it('should filter entries by tier without changing the summary counts', async () => {
    const rows = [
      { member_id: 'mem_1', member_name: 'Budi Santoso', member_external_id: 'CC-001', member_division: null, member_group: null, status: 'active', total_events_attended: 4, total_checkins: 4, last_attended_at: null },
      { member_id: 'mem_2', member_name: 'Siti Aminah', member_external_id: 'CC-002', member_division: null, member_group: null, status: 'active', total_events_attended: 2, total_checkins: 2, last_attended_at: null },
    ];

    const repo = new AttendanceRepository(mockActivityDb(rows));
    const { entries, summary } = await repo.getMemberActivityStats({
      tier: 'active' as ActivityTier,
    });

    expect(entries.map((e) => e.member_id)).toEqual(['mem_2']);
    // Summary counters aggregate over ALL rows, not the filtered page.
    expect(summary.total_members).toBe(2);
    expect(summary.highly_active_count).toBe(1);
    expect(summary.active_count).toBe(1);
  });

  /**
   * NOTE: the Scanner's "only active events" filter lives at
   * `src/client/pages/ScannerPage.tsx:37-40` as a `useMemo` inside the
   * component. It is real production code but not an exported symbol, and this
   * suite has no DOM renderer, so it cannot be reached from here. The local
   * `events.filter(...)` copy that stood in for it asserted only
   * `Array.prototype.filter` semantics and has been removed; if a DOM test
   * environment is added, that filter belongs in a component test against
   * `ScannerPage`.
   */
});
