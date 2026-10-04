import { invalidateEdgeCache } from './edge-cache';

export interface MutationAudit {
  adminId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | string;
}

export interface MutationTask<T = unknown> {
  statements: D1PreparedStatement[];
  cacheTags?: string[];
  audit?: MutationAudit;
  resultTransform?: (results: D1Response[]) => T;
}

export class MutationCoordinator {
  constructor(
    private db: D1Database,
    private ctx?: unknown
  ) {}

  async execute<T = D1Response[]>(task: MutationTask<T>): Promise<T> {
    const statementsToRun = [...task.statements];

    if (task.audit) {
      const auditId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const meta =
        typeof task.audit.meta === 'string'
          ? task.audit.meta
          : JSON.stringify(task.audit.meta || {});

      const auditStmt = this.db
        .prepare(
          `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, meta, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          auditId,
          task.audit.adminId ?? null,
          task.audit.action,
          task.audit.entityType ?? null,
          task.audit.entityId ?? null,
          meta
        );

      statementsToRun.push(auditStmt);
    }

    const results = await this.db.batch(statementsToRun);

    if (task.cacheTags && task.cacheTags.length > 0) {
      await invalidateEdgeCache(task.cacheTags, this.ctx);
    }

    if (task.resultTransform) {
      return task.resultTransform(results);
    }

    return results as unknown as T;
  }
}
