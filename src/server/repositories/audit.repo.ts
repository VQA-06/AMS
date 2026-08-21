import { AuditLog, ScanAttempt } from '@/shared/types';

export class AuditRepository {
  constructor(private db: D1Database) {}

  async logAction(data: {
    admin_id?: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    meta?: Record<string, unknown> | string;
  }): Promise<void> {
    const id = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const meta = typeof data.meta === 'string' ? data.meta : JSON.stringify(data.meta || {});

    await this.db
      .prepare(
        `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, meta, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        id,
        data.admin_id ?? null,
        data.action,
        data.entity_type ?? null,
        data.entity_id ?? null,
        meta
      )
      .run();
  }

  async recordFailedScan(data: {
    eventId?: string | null;
    tokenJti?: string | null;
    memberId?: string | null;
    reason: string;
    stationId?: string | null;
    operatorId?: string | null;
  }): Promise<void> {
    const id = `sca_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await this.db
      .prepare(
        `INSERT INTO scan_attempts (id, event_id, token_jti, member_id, result, reason, station_id, operator_id, created_at)
         VALUES (?, ?, ?, ?, 'failed', ?, ?, ?, datetime('now'))`
      )
      .bind(
        id,
        data.eventId ?? null,
        data.tokenJti ?? null,
        data.memberId ?? null,
        data.reason,
        data.stationId ?? null,
        data.operatorId ?? null
      )
      .run();
  }

  async listLogs(limit = 100): Promise<AuditLog[]> {
    const res = await this.db
      .prepare(
        `SELECT a.*, adm.name as admin_name, adm.email as admin_email
         FROM audit_logs a
         LEFT JOIN admins adm ON a.admin_id = adm.id
         ORDER BY a.created_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<AuditLog>();
    return res.results ?? [];
  }

  async listRecentScanAttempts(eventId?: string, limit = 20): Promise<ScanAttempt[]> {
    const query = eventId
      ? 'SELECT * FROM scan_attempts WHERE event_id = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM scan_attempts ORDER BY created_at DESC LIMIT ?';
    const params = eventId ? [eventId, limit] : [limit];

    const res = await this.db.prepare(query).bind(...params).all<ScanAttempt>();
    return res.results ?? [];
  }
}
