import { Hono } from 'hono';
import { StatusCode } from 'hono/utils/http-status';
import { Env } from '../env';
import { authMiddleware, requireRole } from '../middleware/auth';
import { invalidateEdgeCache } from '../lib/edge-cache';
import { createRateLimiter } from '../middleware/rate-limit';
import { scanRequestSchema } from '@/shared/schemas/scan.schema';
import { ApiResponse, SessionType } from '@/shared/types';
import { DefaultAttendanceEngine } from '../domain/attendance/attendance-engine';

const scanRoutes = new Hono<{ Bindings: Env }>();

// POST /api/scan - Scan and validate attendance
scanRoutes.post(
  '/',
  authMiddleware,
  requireRole(['owner', 'admin', 'operator']),
  createRateLimiter({ maxRequests: 60, windowSeconds: 60, keyPrefix: 'scan' }),
  async (c) => {
    const body = await c.req.json();
    const input = scanRequestSchema.parse(body);
    const admin = c.get('admin');

    const engine = new DefaultAttendanceEngine(c.env.DB, c.env);
    const result = await engine.recordScan({
      eventId: input.eventId,
      qrToken: input.qr,
      sessionType: input.sessionType as SessionType,
      stationId: input.stationId,
      operatorId: admin?.id,
    });

    if (!result.success) {
      const statusCode = result.error?.status_code || 400;
      return c.json<ApiResponse>(
        {
          ok: false,
          error: result.error,
        },
        statusCode
      );
    }

    await invalidateEdgeCache(['attendance', 'agenda', 'members'], c);

    return c.json<ApiResponse>({
      ok: true,
      data: {
        attendance: result.attendance,
      },
    });
  }
);

export { scanRoutes };
