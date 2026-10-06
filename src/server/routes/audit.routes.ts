import { Hono } from 'hono';
import { Env } from '../env';
import { AuditRepository } from '../repositories/audit.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { ApiResponse } from '@/shared/types';

const auditRoutes = new Hono<{ Bindings: Env }>();

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}***` : `${name.slice(0, 2)}***`;
  return `${maskedName}@${domain}`;
}

function sanitizeAuditLogsForAuditor(logs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return logs.map((log) => {
    const copy = { ...log };
    if (typeof copy.admin_email === 'string') {
      copy.admin_email = maskEmail(copy.admin_email);
    }
    if (copy.meta) {
      try {
        const metaObj =
          typeof copy.meta === 'string'
            ? JSON.parse(copy.meta)
            : (copy.meta as Record<string, unknown>);
        if (metaObj && typeof metaObj === 'object') {
          const sanitizedMeta = { ...metaObj };
          if (typeof sanitizedMeta.email === 'string') {
            sanitizedMeta.email = maskEmail(sanitizedMeta.email);
          }
          copy.meta = typeof copy.meta === 'string' ? JSON.stringify(sanitizedMeta) : sanitizedMeta;
        }
      } catch {
        // ignore parse errors
      }
    }
    return copy;
  });
}

// GET /api/audit/logs - List system audit logs
auditRoutes.get('/logs', authMiddleware, requireRole(['owner', 'admin', 'auditor']), async (c) => {
  const currentAdmin = c.get('admin');
  const repo = new AuditRepository(c.env.DB);
  const rawLogs = await repo.listLogs(100);

  const logs =
    currentAdmin?.role === 'auditor'
      ? sanitizeAuditLogsForAuditor(rawLogs as unknown as Array<Record<string, unknown>>)
      : rawLogs;

  return c.json<ApiResponse>({
    ok: true,
    data: { logs },
  });
});

// GET /api/audit/scans - List recent scan attempts
auditRoutes.get('/scans', authMiddleware, async (c) => {
  const eventId = c.req.query('event_id');
  const repo = new AuditRepository(c.env.DB);
  const scans = await repo.listRecentScanAttempts(eventId, 20);

  return c.json<ApiResponse>({
    ok: true,
    data: { scans },
  });
});

export { auditRoutes };
