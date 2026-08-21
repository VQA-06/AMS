import { Hono } from 'hono';
import { Env } from '../env';
import { AuditRepository } from '../repositories/audit.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { ApiResponse } from '@/shared/types';

const auditRoutes = new Hono<{ Bindings: Env }>();

// GET /api/audit/logs - List system audit logs
auditRoutes.get('/logs', authMiddleware, requireRole(['owner', 'admin', 'auditor']), async (c) => {
  const repo = new AuditRepository(c.env.DB);
  const logs = await repo.listLogs(100);

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
