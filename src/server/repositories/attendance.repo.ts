import { Attendance, SessionType, MemberActivityEntry, ActivityTier, MemberActivitySummary, Status } from '@/shared/types';
import { escapeLikePattern } from '../lib/sql-utils';

export interface AttendanceFilterOptions {
  event_id: string;
  division?: string;
  group_name?: string;
  session_type?: SessionType;
  search?: string;
  page?: number;
  limit?: number;
}

export class AttendanceRepository {
  constructor(private db: D1Database) {}

  async findByEventMemberSession(
    eventId: string,
    memberId: string,
    sessionType: SessionType
  ): Promise<Attendance | null> {
    const res = await this.db
      .prepare(
        'SELECT * FROM attendances WHERE event_id = ? AND member_id = ? AND session_type = ? LIMIT 1'
      )
      .bind(eventId, memberId, sessionType)
      .first<Attendance>();
    return res ?? null;
  }

  async listByEvent(options: AttendanceFilterOptions): Promise<{ attendances: Attendance[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(200, options.limit || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['a.event_id = ?'];
    const params: (string | number)[] = [options.event_id];

    if (options.session_type) {
      conditions.push('a.session_type = ?');
      params.push(options.session_type);
    }

    if (options.division) {
      conditions.push('m.division = ?');
      params.push(options.division);
    }

    if (options.group_name) {
      conditions.push('m.group_name = ?');
      params.push(options.group_name);
    }

    if (options.search && options.search.trim() !== '') {
      const sanitized = escapeLikePattern(options.search.trim());
      const s = `%${sanitized}%`;
      conditions.push('(m.name LIKE ? ESCAPE \'\\\' OR m.external_id LIKE ? ESCAPE \'\\\')');
      params.push(s, s);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.db
      .prepare(
        `SELECT COUNT(*) as total
         FROM attendances a
         JOIN members m ON a.member_id = m.id
         ${whereClause}`
      )
      .bind(...params)
      .first<{ total: number }>();
    const total = countRes?.total ?? 0;

    const dataQuery = `
      SELECT a.*,
             m.name as member_name,
             m.external_id as member_external_id,
             m.division as member_division,
             m.group_name as member_group,
             e.name as event_name,
             adm.name as operator_name
      FROM attendances a
      JOIN members m ON a.member_id = m.id
      JOIN events e ON a.event_id = e.id
      LEFT JOIN admins adm ON a.operator_id = adm.id
      ${whereClause}
      ORDER BY a.scanned_at DESC
      LIMIT ? OFFSET ?
    `;

    const rawAttendances = await this.db
      .prepare(dataQuery)
      .bind(...params, limit, offset)
      .all<Attendance>();

    return {
      attendances: rawAttendances.results ?? [],
      total,
    };
  }

  async getAllForExport(options: Omit<AttendanceFilterOptions, 'page' | 'limit'>): Promise<Attendance[]> {
    const conditions: string[] = [];
    const params: string[] = [];

    if (options.event_id) {
      conditions.push('a.event_id = ?');
      params.push(options.event_id);
    }

    if (options.session_type) {
      conditions.push('a.session_type = ?');
      params.push(options.session_type);
    }

    if (options.division) {
      conditions.push('m.division = ?');
      params.push(options.division);
    }

    if (options.group_name) {
      conditions.push('m.group_name = ?');
      params.push(options.group_name);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT a.*,
             m.name as member_name,
             m.external_id as member_external_id,
             m.division as member_division,
             m.group_name as member_group,
             e.name as event_name,
             adm.name as operator_name
      FROM attendances a
      JOIN members m ON a.member_id = m.id
      JOIN events e ON a.event_id = e.id
      LEFT JOIN admins adm ON a.operator_id = adm.id
      ${whereClause}
      ORDER BY a.scanned_at DESC
    `;

    const res = await this.db.prepare(query).bind(...params).all<Attendance>();
    return res.results ?? [];
  }

  /**
   * Atomic batch transaction to insert attendance, increment token usage,
   * and log a successful scan attempt.
   */
  async recordScanAtomic(data: {
    attendanceId: string;
    eventId: string;
    memberId: string;
    qrTokenId: string;
    sessionType: SessionType;
    stationId?: string | null;
    operatorId?: string | null;
    tokenJti: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const insertAttendance = this.db
      .prepare(
        `INSERT INTO attendances (id, event_id, member_id, qr_token_id, session_type, scanned_at, station_id, operator_id, is_manual, meta)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, 0, ?)`
      )
      .bind(
        data.attendanceId,
        data.eventId,
        data.memberId,
        data.qrTokenId,
        data.sessionType,
        data.stationId ?? null,
        data.operatorId ?? null,
        JSON.stringify(data.meta ?? {})
      );

    const updateTokenUse = this.db
      .prepare(
        `UPDATE qr_tokens SET uses_count = uses_count + 1 WHERE id = ? AND (max_uses IS NULL OR uses_count < max_uses)`
      )
      .bind(data.qrTokenId);

    const insertAttempt = this.db
      .prepare(
        `INSERT INTO scan_attempts (id, event_id, token_jti, member_id, result, reason, station_id, operator_id, created_at)
         VALUES (?, ?, ?, ?, 'success', NULL, ?, ?, datetime('now'))`
      )
      .bind(
        `sca_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        data.eventId,
        data.tokenJti,
        data.memberId,
        data.stationId ?? null,
        data.operatorId ?? null
      );

    await this.db.batch([insertAttendance, updateTokenUse, insertAttempt]);
  }

  /**
   * Record manual attendance
   */
  async recordManual(data: {
    attendanceId: string;
    eventId: string;
    memberId: string;
    qrTokenId?: string | null;
    sessionType: SessionType;
    operatorId: string;
    stationId?: string | null;
    reason: string;
  }): Promise<void> {
    const qrTokenId = data.qrTokenId || 'MANUAL';
    const meta = JSON.stringify({ manualReason: data.reason });

    const insertAttendance = this.db
      .prepare(
        `INSERT INTO attendances (id, event_id, member_id, qr_token_id, session_type, scanned_at, station_id, operator_id, is_manual, meta)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, 1, ?)`
      )
      .bind(
        data.attendanceId,
        data.eventId,
        data.memberId,
        qrTokenId,
        data.sessionType,
        data.stationId ?? null,
        data.operatorId,
        meta
      );

    const insertAttempt = this.db
      .prepare(
        `INSERT INTO scan_attempts (id, event_id, token_jti, member_id, result, reason, station_id, operator_id, created_at)
         VALUES (?, ?, ?, ?, 'success', ?, ?, ?, datetime('now'))`
      )
      .bind(
        `sca_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        data.eventId,
        null,
        data.memberId,
        `Manual: ${data.reason}`,
        data.stationId ?? null,
        data.operatorId
      );

    await this.db.batch([insertAttendance, insertAttempt]);
  }

  /**
   * Get member activity statistics categorized by attendance levels
   */
  async getMemberActivityStats(options: {
    division?: string;
    search?: string;
    tier?: ActivityTier;
  } = {}): Promise<{
    entries: MemberActivityEntry[];
    summary: MemberActivitySummary;
  }> {
    // 1. Get total active/closed events count for baseline rate
    const eventCountRes = await this.db
      .prepare(`SELECT COUNT(*) as total_events FROM events WHERE status IN ('active', 'closed', 'archived')`)
      .first<{ total_events: number }>();
    const totalEvents = Math.max(1, eventCountRes?.total_events ?? 0);

    // 2. Query members with aggregated attendance (excluding temporary/guest participants)
    const conditions: string[] = [
      'm.status = ?',
      "(m.group_name NOT LIKE 'Tamu:%' OR m.group_name IS NULL)",
      "m.external_id NOT LIKE 'GUEST-%'",
      "(m.metadata NOT LIKE '%\"temporary\":true%' AND m.metadata NOT LIKE '%\"temporary\": true%' OR m.metadata IS NULL)",
    ];
    const params: (string | number)[] = ['active'];

    if (options.division && options.division.trim() !== '' && options.division !== 'all') {
      conditions.push('m.division = ?');
      params.push(options.division.trim());
    }

    if (options.search && options.search.trim() !== '') {
      const sanitized = escapeLikePattern(options.search.trim());
      const s = `%${sanitized}%`;
      conditions.push('(m.name LIKE ? ESCAPE \'\\\' OR m.external_id LIKE ? ESCAPE \'\\\')');
      params.push(s, s);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT m.id as member_id,
             m.name as member_name,
             m.external_id as member_external_id,
             m.division as member_division,
             m.group_name as member_group,
             m.status,
             COUNT(DISTINCT a.event_id) as total_events_attended,
             COUNT(a.id) as total_checkins,
             MAX(a.scanned_at) as last_attended_at
      FROM members m
      LEFT JOIN attendances a ON m.id = a.member_id AND a.session_type = 'CHECKIN'
      ${whereClause}
      GROUP BY m.id
      ORDER BY total_events_attended DESC, total_checkins DESC, m.name ASC
    `;

    const rawRows = await this.db
      .prepare(query)
      .bind(...params)
      .all<{
        member_id: string;
        member_name: string;
        member_external_id: string;
        member_division: string | null;
        member_group: string | null;
        status: Status;
        total_events_attended: number;
        total_checkins: number;
        last_attended_at: string | null;
      }>();

    let highlyActiveCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;
    let totalRateSum = 0;

    const allEntries: MemberActivityEntry[] = (rawRows.results || []).map((row) => {
      const attended = Number(row.total_events_attended) || 0;
      const rate = Math.min(100, Math.round((attended / totalEvents) * 100));
      totalRateSum += rate;

      let tier: ActivityTier = 'inactive';
      if (attended >= 3 || rate >= 60) {
        tier = 'highly_active';
        highlyActiveCount++;
      } else if (attended >= 1 || rate > 0) {
        tier = 'active';
        activeCount++;
      } else {
        tier = 'inactive';
        inactiveCount++;
      }

      return {
        member_id: row.member_id,
        member_name: row.member_name,
        member_external_id: row.member_external_id,
        member_division: row.member_division,
        member_group: row.member_group,
        status: row.status,
        total_events_attended: attended,
        total_checkins: Number(row.total_checkins) || 0,
        attendance_rate: rate,
        activity_tier: tier,
        last_attended_at: row.last_attended_at,
      };
    });

    const filteredEntries = options.tier
      ? allEntries.filter((e) => e.activity_tier === options.tier)
      : allEntries;

    const totalMembers = allEntries.length;
    const averageRate = totalMembers > 0 ? Math.round(totalRateSum / totalMembers) : 0;

    return {
      entries: filteredEntries,
      summary: {
        total_members: totalMembers,
        total_events: totalEvents,
        highly_active_count: highlyActiveCount,
        active_count: activeCount,
        inactive_count: inactiveCount,
        average_attendance_rate: averageRate,
      },
    };
  }
}
