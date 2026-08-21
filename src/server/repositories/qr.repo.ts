import { QrScope, QrToken } from '@/shared/types';

export class QrTokenRepository {
  constructor(private db: D1Database) {}

  async findByJti(jti: string): Promise<QrToken | null> {
    const res = await this.db
      .prepare(
        `SELECT q.*, m.name as member_name, m.external_id as member_external_id, m.division as member_division, e.name as event_name
         FROM qr_tokens q
         JOIN members m ON q.member_id = m.id
         LEFT JOIN events e ON q.event_id = e.id
         WHERE q.jti = ? LIMIT 1`
      )
      .bind(jti)
      .first<QrToken>();
    return res ?? null;
  }

  async findById(id: string): Promise<QrToken | null> {
    const res = await this.db
      .prepare(
        `SELECT q.*, m.name as member_name, m.external_id as member_external_id, m.division as member_division, e.name as event_name
         FROM qr_tokens q
         JOIN members m ON q.member_id = m.id
         LEFT JOIN events e ON q.event_id = e.id
         WHERE q.id = ? LIMIT 1`
      )
      .bind(id)
      .first<QrToken>();
    return res ?? null;
  }

  async listByMember(memberId: string): Promise<QrToken[]> {
    const res = await this.db
      .prepare(
        `SELECT q.*, e.name as event_name
         FROM qr_tokens q
         LEFT JOIN events e ON q.event_id = e.id
         WHERE q.member_id = ?
         ORDER BY q.created_at DESC`
      )
      .bind(memberId)
      .all<QrToken>();
    return res.results ?? [];
  }

  async listByEvent(eventId: string): Promise<QrToken[]> {
    const res = await this.db
      .prepare(
        `SELECT q.*, m.name as member_name, m.external_id as member_external_id, m.division as member_division
         FROM qr_tokens q
         JOIN members m ON q.member_id = m.id
         WHERE q.event_id = ?
         ORDER BY q.created_at DESC`
      )
      .bind(eventId)
      .all<QrToken>();
    return res.results ?? [];
  }

  async create(token: {
    id: string;
    jti: string;
    member_id: string;
    event_id?: string | null;
    scope: QrScope;
    valid_from: string;
    expires_at: string;
    max_uses?: number | null;
    created_by?: string | null;
    note?: string | null;
  }): Promise<QrToken> {
    await this.db
      .prepare(
        `INSERT INTO qr_tokens (id, jti, member_id, event_id, scope, valid_from, expires_at, max_uses, uses_count, created_by, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`
      )
      .bind(
        token.id,
        token.jti,
        token.member_id,
        token.event_id ?? null,
        token.scope,
        token.valid_from,
        token.expires_at,
        token.max_uses ?? null,
        token.created_by ?? null,
        token.note ?? null
      )
      .run();

    const created = await this.findById(token.id);
    if (!created) throw new Error('Failed to create QR token in database');
    return created;
  }

  async createBatch(
    tokens: Array<{
      id: string;
      jti: string;
      member_id: string;
      event_id?: string | null;
      scope: QrScope;
      valid_from: string;
      expires_at: string;
      max_uses?: number | null;
      created_by?: string | null;
      note?: string | null;
    }>
  ): Promise<void> {
    const statements = tokens.map((t) =>
      this.db
        .prepare(
          `INSERT INTO qr_tokens (id, jti, member_id, event_id, scope, valid_from, expires_at, max_uses, uses_count, created_by, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`
        )
        .bind(
          t.id,
          t.jti,
          t.member_id,
          t.event_id ?? null,
          t.scope,
          t.valid_from,
          t.expires_at,
          t.max_uses ?? null,
          t.created_by ?? null,
          t.note ?? null
        )
    );

    await this.db.batch(statements);
  }

  async revoke(id: string): Promise<boolean> {
    const res = await this.db
      .prepare("UPDATE qr_tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL")
      .bind(id)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.db
      .prepare('DELETE FROM qr_tokens WHERE id = ?')
      .bind(id)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
}
