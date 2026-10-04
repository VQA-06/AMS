import { Hono, Context } from 'hono';
import { StatusCode } from 'hono/utils/http-status';
import Papa from 'papaparse';
import { Env } from '../env';
import { AttendanceRepository } from '../repositories/attendance.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limit';
import { edgeCache } from '../middleware/edge-cache';
import { invalidateEdgeCache } from '../lib/edge-cache';
import { manualAttendanceSchema } from '@/shared/schemas/scan.schema';
import { ApiResponse, SessionType } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';
import { sanitizeCsvRow } from '../lib/csv-sanitizer';
import { DefaultAttendanceEngine } from '../domain/attendance/attendance-engine';
import { MutationCoordinator } from '../lib/mutation-coordinator';
const attendanceRoutes = new Hono<{ Bindings: Env }>();

// GET /api/attendances/event/:id - List attendances for an event
attendanceRoutes.get('/event/:id', authMiddleware, async (c) => {
  const eventId = c.req.param('id');
  if (!eventId) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Event ID wajib diisi.',
        },
      },
      400
    );
  }

  const query = c.req.query();
  const repo = new AttendanceRepository(c.env.DB);

  const result = await repo.listByEvent({
    event_id: eventId,
    division: query.division,
    group_name: query.group_name,
    session_type: query.session_type as any,
    search: query.search,
    page: query.page ? parseInt(query.page, 10) : 1,
    limit: query.limit ? parseInt(query.limit, 10) : 50,
  });

  return c.json<ApiResponse>({
    ok: true,
    data: result,
  });
});

// GET /api/attendances/export - Export attendance list
attendanceRoutes.get(
  '/export',
  authMiddleware,
  requireRole(['owner', 'admin', 'auditor']),
  createRateLimiter({ maxRequests: 20, windowSeconds: 60, keyPrefix: 'export_attendances' }),
  async (c) => {
  const query = c.req.query();
  const format = query.format === 'json' ? 'json' : 'csv';
  const repo = new AttendanceRepository(c.env.DB);

  const attendances = await repo.getAllForExport({
    event_id: query.event_id,
    division: query.division,
    group_name: query.group_name,
    session_type: query.session_type as any,
  });

  if (format === 'json') {
    return c.json<ApiResponse>({
      ok: true,
      data: { attendances },
    });
  }

  const csvRows = attendances.map((a) =>
    sanitizeCsvRow({
      event_name: a.event_name || '',
      member_external_id: a.member_external_id || '',
      member_name: a.member_name || '',
      division: a.member_division || '',
      group_name: a.member_group || '',
      session_type: a.session_type,
      scanned_at: a.scanned_at,
      station_id: a.station_id || '',
      operator_name: a.operator_name || '',
      is_manual: a.is_manual ? 'Ya' : 'Tidak',
    })
  );

  const csvString = Papa.unparse(csvRows);

  return c.text(csvString, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="attendance_${new Date().toISOString().slice(0, 10)}.csv"`,
  });
});

// POST /api/attendances/event/:id/manual - Record manual attendance (Fallback)
attendanceRoutes.post('/event/:id/manual', authMiddleware, requireRole(['owner', 'admin', 'operator']), async (c) => {
  const eventId = c.req.param('id');
  if (!eventId) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Event ID wajib diisi.',
        },
      },
      400
    );
  }

  const body = await c.req.json();
  const parsed = manualAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Data input manual presensi tidak valid.',
          details: parsed.error.format(),
        },
      },
      400
    );
  }

  const input = parsed.data;
  const admin = c.get('admin');
  const engine = new DefaultAttendanceEngine(c.env.DB, c.env);

  const result = await engine.recordManual({
    eventId,
    memberId: input.member_id,
    sessionType: input.session_type as SessionType,
    stationId: input.station_id ?? null,
    operatorId: admin?.id,
    reason: input.reason,
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
});

// GET /recap/matrix & /stats/matrix & /activity-tracker - Member activity tracking statistics
const getMemberActivityStatsHandler = async (c: Context<{ Bindings: Env }>) => {
  const query = c.req.query();
  const repo = new AttendanceRepository(c.env.DB);

  const result = await repo.getMemberActivityStats({
    division: query.division,
    search: query.search,
    tier: query.tier as any,
  });

  return c.json<ApiResponse>({
    ok: true,
    data: result,
  });
};
attendanceRoutes.get('/recap/matrix', authMiddleware, edgeCache({ ttlSeconds: 5, tag: 'attendance' }), getMemberActivityStatsHandler);
attendanceRoutes.get('/stats/matrix', authMiddleware, edgeCache({ ttlSeconds: 5, tag: 'attendance' }), getMemberActivityStatsHandler);
attendanceRoutes.get('/stats/tracker', authMiddleware, edgeCache({ ttlSeconds: 5, tag: 'attendance' }), getMemberActivityStatsHandler);
attendanceRoutes.get('/activity-tracker', authMiddleware, edgeCache({ ttlSeconds: 5, tag: 'attendance' }), getMemberActivityStatsHandler);

// POST /api/attendances/bulk-delete - Bulk delete attendance records
attendanceRoutes.post('/bulk-delete', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const ids = Array.isArray(body.ids) ? body.ids : [];

  if (ids.length === 0) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tidak ada data presensi yang dipilih.' } },
      400
    );
  }

  const admin = c.get('admin');
  const coordinator = new MutationCoordinator(c.env.DB, c);
  const placeholders = ids.map(() => '?').join(',');
  const deleteStmt = c.env.DB
    .prepare(`DELETE FROM attendances WHERE id IN (${placeholders})`)
    .bind(...ids);

  await coordinator.execute({
    statements: [deleteStmt],
    cacheTags: ['attendance', 'agenda', 'members'],
    audit: {
      adminId: admin?.id,
      action: 'BULK_DELETE_ATTENDANCES',
      entityType: 'attendance',
      meta: { count: ids.length, ids },
    },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { count: ids.length, message: `Berhasil menghapus ${ids.length} data absensi.` },
  });
});

export { attendanceRoutes };
