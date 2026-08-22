import { Event, EventStatus, QrPolicy } from '@/shared/types';
import { escapeLikePattern } from '../lib/sql-utils';

export class EventRepository {
  constructor(private db: D1Database) {}

  async list(options: { status?: EventStatus | 'all'; search?: string } = {}): Promise<Event[]> {
    const conditions: string[] = [];
    const params: string[] = [];

    if (options.status && options.status !== 'all') {
      conditions.push('e.status = ?');
      params.push(options.status);
    }

    if (options.search && options.search.trim() !== '') {
      conditions.push('(e.name LIKE ? ESCAPE \'\\\' OR e.location_name LIKE ? ESCAPE \'\\\')');
      const sanitized = escapeLikePattern(options.search.trim());
      const s = `%${sanitized}%`;
      params.push(s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.db
      .prepare(`
        SELECT e.*,
               (SELECT COUNT(*) FROM attendances a WHERE a.event_id = e.id) as attendance_count,
               (SELECT COUNT(*) FROM attendances a WHERE a.event_id = e.id AND a.session_type = 'CHECKIN') as checkin_count,
               (SELECT COUNT(*) FROM attendances a WHERE a.event_id = e.id AND a.session_type = 'CHECKOUT') as checkout_count,
               (SELECT COUNT(*) FROM attendances a JOIN members m ON a.member_id = m.id WHERE a.event_id = e.id AND (m.external_id LIKE 'GUEST-%' OR m.group_name LIKE 'Tamu:%')) as guest_count,
               (SELECT COUNT(*) FROM attendances a JOIN members m ON a.member_id = m.id WHERE a.event_id = e.id AND m.external_id NOT LIKE 'GUEST-%' AND (m.group_name NOT LIKE 'Tamu:%' OR m.group_name IS NULL)) as member_count
        FROM events e
        ${whereClause}
        ORDER BY e.created_at DESC
      `)
      .bind(...params)
      .all<Event>();

    return res.results ?? [];
  }

  async findById(id: string): Promise<Event | null> {
    const res = await this.db
      .prepare('SELECT * FROM events WHERE id = ? LIMIT 1')
      .bind(id)
      .first<Event>();
    return res ?? null;
  }

  async create(data: {
    name: string;
    description?: string | null;
    location_name?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    qr_policy?: QrPolicy;
    status?: EventStatus;
    session_modes?: string;
    allow_manual_attendance?: number;
    grace_minutes?: number;
  }): Promise<Event> {
    const id = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const qr_policy = data.qr_policy || 'universal_allowed';
    const status = data.status || 'draft';
    const session_modes = data.session_modes || '["CHECKIN"]';
    const allow_manual = data.allow_manual_attendance ?? 0;
    const grace_minutes = data.grace_minutes ?? 30;

    await this.db
      .prepare(
        `INSERT INTO events (id, name, description, location_name, starts_at, ends_at, qr_policy, status, session_modes, allow_manual_attendance, grace_minutes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(
        id,
        data.name.trim(),
        data.description ?? null,
        data.location_name ?? null,
        data.starts_at ?? null,
        data.ends_at ?? null,
        qr_policy,
        status,
        session_modes,
        allow_manual,
        grace_minutes
      )
      .run();

    const created = await this.findById(id);
    if (!created) throw new Error('Failed to create event');
    return created;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      location_name: string | null;
      starts_at: string | null;
      ends_at: string | null;
      qr_policy: QrPolicy;
      status: EventStatus;
      session_modes: string;
      allow_manual_attendance: number;
      grace_minutes: number;
    }>
  ): Promise<Event | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description ?? null);
    }
    if (data.location_name !== undefined) {
      fields.push('location_name = ?');
      values.push(data.location_name ?? null);
    }
    if (data.starts_at !== undefined) {
      fields.push('starts_at = ?');
      values.push(data.starts_at ?? null);
    }
    if (data.ends_at !== undefined) {
      fields.push('ends_at = ?');
      values.push(data.ends_at ?? null);
    }
    if (data.qr_policy !== undefined) {
      fields.push('qr_policy = ?');
      values.push(data.qr_policy);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.session_modes !== undefined) {
      fields.push('session_modes = ?');
      values.push(data.session_modes);
    }
    if (data.allow_manual_attendance !== undefined) {
      fields.push('allow_manual_attendance = ?');
      values.push(data.allow_manual_attendance);
    }
    if (data.grace_minutes !== undefined) {
      fields.push('grace_minutes = ?');
      values.push(data.grace_minutes);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    await this.db
      .prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id);
  }

  async getSummary(id: string): Promise<{
    event: Event | null;
    total_scanned: number;
    total_tokens: number;
  }> {
    const event = await this.findById(id);
    if (!event) return { event: null, total_scanned: 0, total_tokens: 0 };

    const scanCountRes = await this.db
      .prepare('SELECT COUNT(*) as count FROM attendances WHERE event_id = ?')
      .bind(id)
      .first<{ count: number }>();

    const tokenCountRes = await this.db
      .prepare('SELECT COUNT(*) as count FROM qr_tokens WHERE event_id = ?')
      .bind(id)
      .first<{ count: number }>();

    return {
      event,
      total_scanned: scanCountRes?.count ?? 0,
      total_tokens: tokenCountRes?.count ?? 0,
    };
  }

  async delete(id: string): Promise<boolean> {
    // 1. Find temporary guest members tied to this event
    const guestMembers = await this.db
      .prepare(`
        SELECT id FROM members
        WHERE (
          json_extract(metadata, '$.event_id') = ?
          OR metadata LIKE ?
          OR group_name LIKE ?
          OR id IN (SELECT member_id FROM qr_tokens WHERE event_id = ?)
        )
        AND (
          json_extract(metadata, '$.temporary') = 1
          OR json_extract(metadata, '$.temporary') = true
          OR metadata LIKE '%"temporary":true%'
          OR metadata LIKE '%"temporary": true%'
          OR external_id LIKE 'GUEST-%'
          OR group_name LIKE 'Tamu:%'
        )
      `)
      .bind(id, `%"event_id":"${id}"%`, `Tamu:%`, id)
      .all<{ id: string }>();

    const guestIds = (guestMembers.results || []).map((r) => r.id);

    const statements: D1PreparedStatement[] = [
      this.db.prepare('DELETE FROM attendances WHERE event_id = ?').bind(id),
      this.db.prepare('DELETE FROM scan_attempts WHERE event_id = ?').bind(id),
      this.db.prepare('DELETE FROM qr_tokens WHERE event_id = ?').bind(id),
    ];

    if (guestIds.length > 0) {
      const placeholders = guestIds.map(() => '?').join(',');
      statements.push(
        this.db.prepare(`DELETE FROM attendances WHERE member_id IN (${placeholders})`).bind(...guestIds),
        this.db.prepare(`DELETE FROM scan_attempts WHERE member_id IN (${placeholders})`).bind(...guestIds),
        this.db.prepare(`DELETE FROM qr_tokens WHERE member_id IN (${placeholders})`).bind(...guestIds),
        this.db.prepare(`DELETE FROM members WHERE id IN (${placeholders})`).bind(...guestIds),
      );
    }

    statements.push(this.db.prepare('DELETE FROM events WHERE id = ?').bind(id));

    await this.db.batch(statements);
    return true;
  }

  /**
   * Aggregates attendance statistics across events for top attendance dashboard rankings.
   */
  async getTopAttendanceEvents(): Promise<
    Array<{
      id: string;
      name: string;
      status: EventStatus;
      starts_at: string | null;
      ends_at: string | null;
      qr_policy: QrPolicy;
      location_name: string | null;
      attendance_count: number;
      checkin_count: number;
      checkout_count: number;
      guest_count: number;
      member_count: number;
    }>
  > {
    const query = `
      SELECT e.id, e.name, e.status, e.starts_at, e.ends_at, e.qr_policy, e.location_name,
             COUNT(DISTINCT a.id) as attendance_count,
             COUNT(DISTINCT CASE WHEN a.session_type = 'CHECKIN' THEN a.id END) as checkin_count,
             COUNT(DISTINCT CASE WHEN a.session_type = 'CHECKOUT' THEN a.id END) as checkout_count,
             COUNT(DISTINCT CASE WHEN m.external_id LIKE 'GUEST-%' OR m.group_name LIKE 'Tamu:%' THEN a.id END) as guest_count,
             COUNT(DISTINCT CASE WHEN m.external_id NOT LIKE 'GUEST-%' AND (m.group_name NOT LIKE 'Tamu:%' OR m.group_name IS NULL) THEN a.id END) as member_count
      FROM events e
      LEFT JOIN attendances a ON e.id = a.event_id
      LEFT JOIN members m ON a.member_id = m.id
      GROUP BY e.id
      ORDER BY attendance_count DESC, e.starts_at DESC
    `;

    const res = await this.db.prepare(query).all<{
      id: string;
      name: string;
      status: EventStatus;
      starts_at: string | null;
      ends_at: string | null;
      qr_policy: QrPolicy;
      location_name: string | null;
      attendance_count: number;
      checkin_count: number;
      checkout_count: number;
      guest_count: number;
      member_count: number;
    }>();

    return res.results ?? [];
  }
}
