import { Member, Status } from '@/shared/types';
import { chunkArray } from '../lib/d1-utils';
import { escapeLikePattern } from '../lib/sql-utils';

export interface MemberFilterOptions {
  search?: string;
  group_name?: string;
  division?: string;
  status?: Status | 'all';
  exclude_temporary?: boolean;
  page?: number;
  limit?: number;
}

export class MemberRepository {
  constructor(private db: D1Database) {}

  async list(options: MemberFilterOptions = {}): Promise<{ members: Member[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(200, options.limit || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Exclude temporary guest participants by default unless explicitly allowed
    if (options.exclude_temporary !== false) {
      conditions.push("(group_name NOT LIKE 'Tamu:%' OR group_name IS NULL)");
      conditions.push("external_id NOT LIKE 'GUEST-%'");
      conditions.push("(metadata NOT LIKE '%\"temporary\":true%' AND metadata NOT LIKE '%\"temporary\": true%' OR metadata IS NULL)");
    }

    if (options.status && options.status !== 'all') {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options.group_name) {
      conditions.push('group_name = ?');
      params.push(options.group_name);
    }

    if (options.division) {
      conditions.push('division = ?');
      params.push(options.division);
    }

    if (options.search && options.search.trim() !== '') {
      const sanitized = escapeLikePattern(options.search.trim());
      const s = `%${sanitized}%`;
      conditions.push('(name LIKE ? ESCAPE \'\\\' OR external_id LIKE ? ESCAPE \'\\\' OR email LIKE ? ESCAPE \'\\\' OR phone LIKE ? ESCAPE \'\\\')');
      params.push(s, s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countRes = await this.db
      .prepare(`SELECT COUNT(*) as total FROM members ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();
    const total = countRes?.total ?? 0;

    // Data query
    const dataQuery = `
      SELECT * FROM members
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const membersRes = await this.db
      .prepare(dataQuery)
      .bind(...params, limit, offset)
      .all<Member>();

    return {
      members: membersRes.results ?? [],
      total,
    };
  }

  async findById(id: string): Promise<Member | null> {
    const res = await this.db
      .prepare('SELECT * FROM members WHERE id = ? LIMIT 1')
      .bind(id)
      .first<Member>();
    return res ?? null;
  }

  async findByExternalId(externalId: string): Promise<Member | null> {
    const res = await this.db
      .prepare('SELECT * FROM members WHERE external_id = ? LIMIT 1')
      .bind(externalId.trim())
      .first<Member>();
    return res ?? null;
  }

  async findByIds(ids: string[]): Promise<Member[]> {
    if (!ids || ids.length === 0) return [];
    const chunks = chunkArray(ids, 50);
    const results: Member[] = [];

    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(',');
      const res = await this.db
        .prepare(`SELECT * FROM members WHERE id IN (${placeholders})`)
        .bind(...chunk)
        .all<Member>();
      if (res.results) {
        results.push(...res.results);
      }
    }
    return results;
  }

  async getDivisions(): Promise<string[]> {
    const res = await this.db
      .prepare(`
        SELECT DISTINCT division 
        FROM members 
        WHERE division IS NOT NULL 
          AND division != '' 
          AND (group_name NOT LIKE 'Tamu:%' OR group_name IS NULL)
          AND external_id NOT LIKE 'GUEST-%'
          AND (metadata NOT LIKE '%"temporary":true%' AND metadata NOT LIKE '%"temporary": true%' OR metadata IS NULL)
        ORDER BY division ASC
      `)
      .all<{ division: string }>();
    return (res.results ?? []).map((r) => r.division);
  }

  async getGroups(): Promise<string[]> {
    const res = await this.db
      .prepare(`
        SELECT DISTINCT group_name 
        FROM members 
        WHERE group_name IS NOT NULL 
          AND group_name != '' 
          AND group_name NOT LIKE 'Tamu:%'
          AND external_id NOT LIKE 'GUEST-%'
          AND (metadata NOT LIKE '%"temporary":true%' AND metadata NOT LIKE '%"temporary": true%' OR metadata IS NULL)
        ORDER BY group_name ASC
      `)
      .all<{ group_name: string }>();
    return (res.results ?? []).map((r) => r.group_name);
  }

  async create(data: {
    external_id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    group_name?: string | null;
    division?: string | null;
    status?: Status;
    metadata?: string;
  }): Promise<Member> {
    const id = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const status = data.status || 'active';
    const metadata = data.metadata || '{}';

    // Auto-generate external_id if empty or missing
    let externalId = data.external_id?.trim();
    if (!externalId) {
      externalId = `MBR-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    await this.db
      .prepare(
        `INSERT INTO members (id, external_id, name, email, phone, group_name, division, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(
        id,
        externalId,
        data.name.trim(),
        data.email ?? null,
        data.phone ?? null,
        data.group_name ?? null,
        data.division ?? null,
        status,
        metadata
      )
      .run();

    const created = await this.findById(id);
    if (!created) throw new Error('Failed to create member');
    return created;
  }

  async createBatch(
    membersData: Array<{
      id: string;
      external_id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      group_name?: string | null;
      division?: string | null;
      status?: Status;
      metadata?: string;
    }>
  ): Promise<void> {
    if (!membersData || membersData.length === 0) return;
    const chunks = chunkArray(membersData, 50);

    for (const chunk of chunks) {
      const statements = chunk.map((m) => {
        return this.db
          .prepare(
            `INSERT INTO members (id, external_id, name, email, phone, group_name, division, status, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          )
          .bind(
            m.id,
            m.external_id,
            m.name.trim(),
            m.email ?? null,
            m.phone ?? null,
            m.group_name ?? null,
            m.division ?? null,
            m.status || 'active',
            m.metadata || '{}'
          );
      });
      await this.db.batch(statements);
    }
  }

  async update(
    id: string,
    data: Partial<{
      external_id: string;
      name: string;
      email: string | null;
      phone: string | null;
      group_name: string | null;
      division: string | null;
      status: Status;
      metadata: string;
    }>
  ): Promise<Member | null> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.external_id !== undefined) {
      fields.push('external_id = ?');
      values.push(data.external_id.trim());
    }
    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email);
    }
    if (data.phone !== undefined) {
      fields.push('phone = ?');
      values.push(data.phone);
    }
    if (data.group_name !== undefined) {
      fields.push('group_name = ?');
      values.push(data.group_name);
    }
    if (data.division !== undefined) {
      fields.push('division = ?');
      values.push(data.division);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(data.metadata);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    await this.db
      .prepare(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.db
      .prepare("UPDATE members SET status = 'inactive', updated_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    // Delete associated tokens, attendances, scan attempts, and member record atomically
    await this.db.batch([
      this.db.prepare('DELETE FROM attendances WHERE member_id = ?').bind(id),
      this.db.prepare('DELETE FROM scan_attempts WHERE member_id = ?').bind(id),
      this.db.prepare('DELETE FROM qr_tokens WHERE member_id = ?').bind(id),
      this.db.prepare('DELETE FROM members WHERE id = ?').bind(id),
    ]);
    return true;
  }

  /**
   * Remove all temporary guest members and their associated tokens, scan attempts, and attendances.
   */
  async cleanupAllGuestMembers(): Promise<number> {
    const guestMembers = await this.db
      .prepare(`
        SELECT id FROM members
        WHERE external_id LIKE 'GUEST-%'
           OR group_name LIKE 'Tamu:%'
           OR json_extract(metadata, '$.temporary') = 1
           OR json_extract(metadata, '$.temporary') = true
           OR metadata LIKE '%"temporary":true%'
           OR metadata LIKE '%"temporary": true%'
      `)
      .all<{ id: string }>();

    const ids = (guestMembers.results || []).map((r) => r.id);
    if (ids.length === 0) return 0;

    const batchSize = 50;
    for (let i = 0; i < ids.length; i += batchSize) {
      const slice = ids.slice(i, i + batchSize);
      const placeholders = slice.map(() => '?').join(',');
      await this.db.batch([
        this.db.prepare(`DELETE FROM attendances WHERE member_id IN (${placeholders})`).bind(...slice),
        this.db.prepare(`DELETE FROM scan_attempts WHERE member_id IN (${placeholders})`).bind(...slice),
        this.db.prepare(`DELETE FROM qr_tokens WHERE member_id IN (${placeholders})`).bind(...slice),
        this.db.prepare(`DELETE FROM members WHERE id IN (${placeholders})`).bind(...slice),
      ]);
    }

    return ids.length;
  }

  /**
   * Promotes a temporary guest member to an official permanent member.
   * Keeps existing attendance records intact while converting IDs and metadata.
   */
  async promoteGuest(
    id: string,
    options?: { newExternalId?: string; division?: string; groupName?: string }
  ): Promise<Member | null> {
    const member = await this.findById(id);
    if (!member) return null;

    // Generate official ID format if not provided or if current is GUEST-*
    let newExternalId = options?.newExternalId?.trim();
    if (!newExternalId || newExternalId.startsWith('GUEST-')) {
      newExternalId = `MBR-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Clean metadata: remove temporary and event-scoping flags, mark as promoted
    let meta: Record<string, unknown> = {};
    try {
      meta = typeof member.metadata === 'string' ? JSON.parse(member.metadata) : member.metadata || {};
    } catch {
      meta = {};
    }
    delete meta.temporary;
    delete meta.event_id;
    meta.is_promoted = true;
    meta.promoted_at = new Date().toISOString();

    const division = options?.division !== undefined ? options.division : member.division;
    const groupName =
      options?.groupName ||
      (member.group_name && member.group_name.startsWith('Tamu:') ? 'Anggota' : member.group_name || 'Anggota');

    // Update member record (attendances automatically reference the updated member data via member_id)
    await this.db
      .prepare(`
        UPDATE members
        SET external_id = ?,
            group_name = ?,
            division = ?,
            status = 'active',
            metadata = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(newExternalId, groupName, division, JSON.stringify(meta), id)
      .run();

    return this.findById(id);
  }

  /**
   * Promotes multiple temporary guest members to official permanent members in a batch.
   */
  async bulkPromoteGuests(
    ids: string[],
    division?: string
  ): Promise<{ count: number; promoted: Member[] }> {
    const promoted: Member[] = [];
    for (const id of ids) {
      const res = await this.promoteGuest(id, { division });
      if (res) {
        promoted.push(res);
      }
    }
    return { count: promoted.length, promoted };
  }

  /**
   * Aggregates member counts grouped by registration year and status for yearly growth charts.
   */
  async getYearlyStats(): Promise<
    Array<{
      year: string;
      active_count: number;
      inactive_count: number;
      total_count: number;
    }>
  > {
    const query = `
      SELECT strftime('%Y', created_at) as year,
             COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) as active_count,
             COUNT(DISTINCT CASE WHEN status = 'inactive' THEN id END) as inactive_count,
             COUNT(DISTINCT id) as total_count
      FROM members
      WHERE external_id NOT LIKE 'GUEST-%' AND (group_name NOT LIKE 'Tamu:%' OR group_name IS NULL)
      GROUP BY year
      ORDER BY year ASC
    `;

    const res = await this.db.prepare(query).all<{
      year: string;
      active_count: number;
      inactive_count: number;
      total_count: number;
    }>();

    return res.results ?? [];
  }
}
