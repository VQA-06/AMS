export interface EventGuestLink {
  id: string;
  event_id: string;
  member_id: string;
  source_event_id: string | null;
  created_at: string;
}

export interface GuestSourceEvent {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  guest_count: number;
}

export interface GuestCandidate {
  member_id: string;
  name: string;
  external_id: string;
  division: string | null;
  token_jti: string;
  token_id: string;
  already_imported: boolean;
}

export interface ImportedGuestTokenRecord {
  link_id: string;
  event_id: string;
  member_id: string;
  source_event_id: string | null;
  source_event_name: string | null;
  member_name: string;
  member_external_id: string;
  member_division: string | null;
  token_id: string;
  token_jti: string;
  token_scope: 'event' | 'universal';
  token_event_id: string;
  token_valid_from: string;
  token_expires_at: string;
  max_uses: number | null;
  uses_count: number;
  revoked_at: string | null;
}

export class EventGuestRepository {
  constructor(private db: D1Database) {}

  /**
   * Returns up to 2 most recent prior events relative to target event that have guest passes.
   */
  async listTwoPreviousEventsWithGuests(targetEventId: string): Promise<GuestSourceEvent[]> {
    const targetEvent = await this.db
      .prepare('SELECT id, starts_at, created_at FROM events WHERE id = ?')
      .bind(targetEventId)
      .first<{ id: string; starts_at: string | null; created_at: string }>();

    if (!targetEvent) {
      return [];
    }

    const targetDate = targetEvent.starts_at || targetEvent.created_at;

    // Fetch up to 2 prior events using index-backed JOIN to eliminate redundant subqueries
    const res = await this.db
      .prepare(`
        SELECT e.id, e.name, e.starts_at, e.ends_at,
               COUNT(DISTINCT g.member_id) as guest_count
        FROM events e
        JOIN (
          SELECT event_id, member_id FROM event_guests
          UNION
          SELECT event_id, member_id FROM qr_tokens WHERE scope = 'event' AND revoked_at IS NULL
        ) g ON g.event_id = e.id
        WHERE e.id != ?
          AND (
            COALESCE(e.starts_at, e.created_at) < ?
            OR (COALESCE(e.starts_at, e.created_at) = ? AND e.id < ?)
          )
        GROUP BY e.id
        HAVING COUNT(DISTINCT g.member_id) > 0
        ORDER BY COALESCE(e.starts_at, e.created_at) DESC, e.created_at DESC
        LIMIT 2
      `)
      .bind(targetEventId, targetDate, targetDate, targetEventId)
      .all<GuestSourceEvent>();

    return res.results ?? [];
  }

  /**
   * Lists candidate guest members from a source event, indicating if already imported to target event
   */
  async listGuestsFromSourceEvent(sourceEventId: string, targetEventId: string): Promise<GuestCandidate[]> {
    const res = await this.db
      .prepare(`
        SELECT
          m.id as member_id,
          m.name,
          m.external_id,
          m.division,
          t.jti as token_jti,
          t.id as token_id,
          CASE WHEN eg_target.id IS NOT NULL THEN 1 ELSE 0 END as already_imported
        FROM (
          SELECT member_id FROM event_guests WHERE event_id = ?
          UNION
          SELECT member_id FROM qr_tokens WHERE event_id = ? AND scope = 'event' AND revoked_at IS NULL
        ) src_guests
        JOIN members m ON src_guests.member_id = m.id
        JOIN qr_tokens t ON t.member_id = m.id AND t.revoked_at IS NULL
        LEFT JOIN event_guests eg_target ON eg_target.event_id = ? AND eg_target.member_id = m.id
        WHERE m.status IN ('active', 'candidate')
        GROUP BY m.id
        ORDER BY m.name ASC
      `)
      .bind(sourceEventId, sourceEventId, targetEventId)
      .all<any>();

    return (res.results || []).map((row) => ({
      member_id: row.member_id,
      name: row.name,
      external_id: row.external_id,
      division: row.division,
      token_jti: row.token_jti,
      token_id: row.token_id,
      already_imported: Boolean(row.already_imported),
    }));
  }

  /**
   * Atomically imports guest member IDs into target event with D1 batch chunking (max 50 stmts/batch).
   * If newExpiresAt is provided, updates existing qr_tokens.expires_at to extend validity for the new event.
   */
  async importGuestsToEvent(
    targetEventId: string,
    guestMemberIds: string[],
    sourceEventId?: string,
    newExpiresAt?: string
  ): Promise<number> {
    if (guestMemberIds.length === 0) return 0;

    const batchSize = newExpiresAt ? 25 : 50;
    let totalInserted = 0;

    for (let i = 0; i < guestMemberIds.length; i += batchSize) {
      const slice = guestMemberIds.slice(i, i + batchSize);
      const stmts: D1PreparedStatement[] = [];

      for (const memberId of slice) {
        const linkId = `eg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        stmts.push(
          this.db
            .prepare(`
              INSERT OR IGNORE INTO event_guests (id, event_id, member_id, source_event_id, created_at)
              VALUES (?, ?, ?, ?, datetime('now'))
            `)
            .bind(linkId, targetEventId, memberId, sourceEventId || null)
        );

        if (newExpiresAt) {
          stmts.push(
            this.db
              .prepare(`
                UPDATE qr_tokens
                SET expires_at = ?
                WHERE member_id = ? AND scope = 'event' AND revoked_at IS NULL AND (expires_at < ? OR expires_at IS NULL)
              `)
              .bind(newExpiresAt, memberId, newExpiresAt)
          );
        }
      }

      const batchRes = await this.db.batch(stmts);
      for (let j = 0; j < batchRes.length; j += newExpiresAt ? 2 : 1) {
        totalInserted += batchRes[j].meta?.changes ?? 0;
      }
    }

    return totalInserted;
  }

  /**
   * Removes authorization link of a guest member for a specific event
   */
  async removeGuestFromEvent(eventId: string, memberId: string): Promise<boolean> {
    const res = await this.db
      .prepare('DELETE FROM event_guests WHERE event_id = ? AND member_id = ?')
      .bind(eventId, memberId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  /**
   * Checks if a guest member is authorized for the given event
   */
  async isGuestAuthorizedForEvent(eventId: string, memberId: string): Promise<boolean> {
    const row = await this.db
      .prepare(`
        SELECT 1 FROM event_guests WHERE event_id = ? AND member_id = ?
        UNION
        SELECT 1 FROM qr_tokens WHERE event_id = ? AND member_id = ? AND revoked_at IS NULL
        LIMIT 1
      `)
      .bind(eventId, memberId, eventId, memberId)
      .first();

    return Boolean(row);
  }

  /**
   * Returns tokens of guests who were imported via event_guests for the specified target event
   */
  async getImportedGuestsForEvent(eventId: string): Promise<ImportedGuestTokenRecord[]> {
    const res = await this.db
      .prepare(`
        SELECT
          eg.id as link_id,
          eg.event_id,
          eg.member_id,
          eg.source_event_id,
          se.name as source_event_name,
          m.name as member_name,
          m.external_id as member_external_id,
          m.division as member_division,
          t.id as token_id,
          t.jti as token_jti,
          t.scope as token_scope,
          t.event_id as token_event_id,
          t.valid_from as token_valid_from,
          t.expires_at as token_expires_at,
          t.max_uses,
          t.uses_count,
          t.revoked_at
        FROM event_guests eg
        JOIN members m ON eg.member_id = m.id
        LEFT JOIN events se ON eg.source_event_id = se.id
        JOIN qr_tokens t ON t.member_id = m.id AND t.revoked_at IS NULL
        WHERE eg.event_id = ?
        GROUP BY m.id
        ORDER BY eg.created_at ASC
      `)
      .bind(eventId)
      .all<any>();

    return (res.results || []).map((r) => ({
      link_id: r.link_id,
      event_id: r.event_id,
      member_id: r.member_id,
      source_event_id: r.source_event_id,
      source_event_name: r.source_event_name,
      member_name: r.member_name,
      member_external_id: r.member_external_id,
      member_division: r.member_division,
      token_id: r.token_id,
      token_jti: r.token_jti,
      token_scope: r.token_scope,
      token_event_id: r.token_event_id,
      token_valid_from: r.token_valid_from,
      token_expires_at: r.token_expires_at,
      max_uses: r.max_uses,
      uses_count: r.uses_count,
      revoked_at: r.revoked_at,
    }));
  }
}

