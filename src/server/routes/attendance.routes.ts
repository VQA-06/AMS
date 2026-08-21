import { Hono } from 'hono';
import Papa from 'papaparse';
import { Env } from '../env';
import { AttendanceRepository } from '../repositories/attendance.repo';
import { MemberRepository } from '../repositories/member.repo';
import { EventRepository } from '../repositories/event.repo';
import { AuditRepository } from '../repositories/audit.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { manualAttendanceSchema } from '@/shared/schemas/scan.schema';
import { ApiResponse } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';
import { sanitizeCsvRow } from '../lib/csv-sanitizer';

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
attendanceRoutes.get('/export', authMiddleware, requireRole(['owner', 'admin', 'auditor']), async (c) => {
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

// POST /api/attendances/event/:id/manual - Manual attendance override
attendanceRoutes.post('/event/:id/manual', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
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
  const input = manualAttendanceSchema.parse(body);

  const eventRepo = new EventRepository(c.env.DB);
  const memberRepo = new MemberRepository(c.env.DB);
  const attendanceRepo = new AttendanceRepository(c.env.DB);
  const auditRepo = new AuditRepository(c.env.DB);

  const event = await eventRepo.findById(eventId);
  if (!event) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan / event tidak ditemukan.',
        },
      },
      404
    );
  }

  if (!event.allow_manual_attendance) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Pencatatan presensi manual dinonaktifkan pada kegiatan ini.',
        },
      },
      400
    );
  }

  const member = await memberRepo.findById(input.member_id);
  if (!member) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.MEMBER_NOT_FOUND,
          message: 'Anggota tidak ditemukan.',
        },
      },
      404
    );
  }

  // Check duplicate
  const existing = await attendanceRepo.findByEventMemberSession(eventId, member.id, input.session_type);
  if (existing) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.ALREADY_SCANNED,
          message: `Anggota sudah tercatat hadir untuk sesi ${input.session_type}.`,
        },
      },
      400
    );
  }

  const admin = c.get('admin');
  const attendanceId = `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await attendanceRepo.recordManual({
    attendanceId,
    eventId,
    memberId: member.id,
    sessionType: input.session_type,
    operatorId: admin.id,
    stationId: input.station_id,
    reason: input.reason,
  });

  await auditRepo.logAction({
    admin_id: admin.id,
    action: 'MANUAL_ATTENDANCE',
    entity_type: 'attendance',
    entity_id: attendanceId,
    meta: {
      event_id: eventId,
      member_id: member.id,
      reason: input.reason,
      session_type: input.session_type,
    },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: {
      attendance: {
        id: attendanceId,
        memberName: member.name,
        memberExternalId: member.external_id,
        memberDivision: member.division,
        eventName: event.name,
        sessionType: input.session_type,
        isManual: true,
        scannedAt: new Date().toISOString(),
      },
    },
  });
});

// GET /api/attendances/activity-tracker - Member activity tracking statistics
attendanceRoutes.get('/activity-tracker', authMiddleware, async (c) => {
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
});

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

  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB
    .prepare(`DELETE FROM attendances WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();

  return c.json<ApiResponse>({
    ok: true,
    data: { count: ids.length, message: `Berhasil menghapus ${ids.length} data absensi.` },
  });
});

export { attendanceRoutes };
