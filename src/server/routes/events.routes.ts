import { Hono, Context } from 'hono';
import { StatusCode } from 'hono/utils/http-status';
import { Env } from '../env';
import { EventRepository } from '../repositories/event.repo';
import { AuditRepository } from '../repositories/audit.repo';
import { EventGuestRepository } from '../repositories/event-guest.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { edgeCache } from '../middleware/edge-cache';
import { invalidateEdgeCache } from '../lib/edge-cache';
import { eventSchema, eventUpdateSchema } from '@/shared/schemas/event.schema';
import { ApiResponse, Event, Status } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';
import { DefaultGuestPassManager } from '../domain/guest/guest-pass-manager';
import { MutationCoordinator } from '../lib/mutation-coordinator';
const eventsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/events - List events
eventsRoutes.get('/', authMiddleware, edgeCache({ ttlSeconds: 15, tag: 'agenda' }), async (c) => {
  const query = c.req.query();
  const repo = new EventRepository(c.env.DB);

  const events = await repo.list({
    status: (query.status as any) || 'all',
    search: query.search,
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { events },
  });
});

// POST /api/events - Create event
eventsRoutes.post('/', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json();
  const input = eventSchema.parse(body);

  const repo = new EventRepository(c.env.DB);
  const created = await repo.create({
    name: input.name,
    description: input.description,
    location_name: input.location_name,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    qr_policy: input.qr_policy,
    status: input.status,
    session_modes: typeof input.session_modes === 'string' ? input.session_modes : JSON.stringify(input.session_modes || ['CHECKIN']),
    allow_manual_attendance: input.allow_manual_attendance ? 1 : 0,
    grace_minutes: input.grace_minutes,
  });

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'CREATE_EVENT',
    entity_type: 'event',
    entity_id: created.id,
    meta: { name: created.name, qr_policy: created.qr_policy },
  });

  await invalidateEdgeCache(['agenda', 'attendance', 'members'], (c as any).executionCtx);

  return c.json<ApiResponse>({
    ok: true,
    data: { event: created },
  });
});

// GET /reports/top-presence & /stats/top-presence & /analytics/top-attendance - Get attendance rankings
const getTopAttendanceHandler = async (c: Context<{ Bindings: Env }>) => {
  const repo = new EventRepository(c.env.DB);
  const events = await repo.getTopAttendanceEvents();

  return c.json<ApiResponse>({
    ok: true,
    data: { events },
  });
};
eventsRoutes.get('/reports/top-presence', authMiddleware, edgeCache({ ttlSeconds: 15, tag: 'agenda' }), getTopAttendanceHandler);
eventsRoutes.get('/stats/top-presence', authMiddleware, edgeCache({ ttlSeconds: 15, tag: 'agenda' }), getTopAttendanceHandler);
eventsRoutes.get('/analytics/top-attendance', authMiddleware, edgeCache({ ttlSeconds: 15, tag: 'agenda' }), getTopAttendanceHandler);

// GET /api/events/:id - Detail event
eventsRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const repo = new EventRepository(c.env.DB);
  const event = await repo.findById(id);

  if (!event) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan tidak ditemukan.',
        },
      },
      404
    );
  }

  return c.json<ApiResponse>({
    ok: true,
    data: { event },
  });
});

// GET /api/events/:id/summary - Summary stats
eventsRoutes.get('/:id/summary', authMiddleware, async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const repo = new EventRepository(c.env.DB);
  const summary = await repo.getSummary(id);

  if (!summary.event) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan tidak ditemukan.',
        },
      },
      404
    );
  }

  return c.json<ApiResponse>({
    ok: true,
    data: summary,
  });
});

// PATCH /api/events/:id - Update event
eventsRoutes.patch('/:id', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
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
  const input = eventUpdateSchema.parse(body);

  const repo = new EventRepository(c.env.DB);
  const existing = await repo.findById(id);
  if (!existing) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan tidak ditemukan.',
        },
      },
      404
    );
  }

  const updated = await repo.update(id, {
    name: input.name,
    description: input.description,
    location_name: input.location_name,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    qr_policy: input.qr_policy,
    status: input.status,
    session_modes:
      input.session_modes !== undefined
        ? typeof input.session_modes === 'string'
          ? input.session_modes
          : JSON.stringify(input.session_modes)
        : undefined,
    allow_manual_attendance:
      input.allow_manual_attendance !== undefined ? (input.allow_manual_attendance ? 1 : 0) : undefined,
    grace_minutes: input.grace_minutes,
  });

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'UPDATE_EVENT',
    entity_type: 'event',
    entity_id: id,
    meta: { changes: input },
  });

  await invalidateEdgeCache(['agenda', 'attendance', 'members'], (c as any).executionCtx);

  return c.json<ApiResponse>({
    ok: true,
    data: { event: updated },
  });
});

// POST /api/events/:id/activate - Activate event
eventsRoutes.post('/:id/activate', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const repo = new EventRepository(c.env.DB);
  const updated = await repo.update(id, { status: 'active' });

  await invalidateEdgeCache(['agenda', 'attendance'], (c as any).executionCtx);

  return c.json<ApiResponse>({
    ok: true,
    data: { event: updated },
  });
});

// POST /api/events/:id/close - Close event
eventsRoutes.post('/:id/close', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const repo = new EventRepository(c.env.DB);
  const updated = await repo.update(id, { status: 'closed' });

  await invalidateEdgeCache(['agenda', 'attendance'], (c as any).executionCtx);

  return c.json<ApiResponse>({
    ok: true,
    data: { event: updated },
  });
});

// DELETE /api/events/:id - Delete event and associated attendance and tokens
eventsRoutes.delete('/:id', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const repo = new EventRepository(c.env.DB);
  const existing = await repo.findById(id);
  if (!existing) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan tidak ditemukan.',
        },
      },
      404
    );
  }

  await repo.delete(id);

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'DELETE_EVENT',
    entity_type: 'event',
    entity_id: id,
    meta: { name: existing.name },
  });

  await invalidateEdgeCache(['agenda', 'attendance', 'members'], (c as any).executionCtx);

  return c.json<ApiResponse>({
    ok: true,
    data: { message: 'Kegiatan berhasil dihapus.' },
  });
});

// POST /:id/guests & /:id/guests/batch & /:id/guests/batch-names - Create temporary guest participants & generate event QR passes
const createGuestPassesHandler = async (c: Context<{ Bindings: Env }>) => {
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
  const rawGuests = Array.isArray(body.guests)
    ? body.guests
    : Array.isArray(body.items)
    ? body.items
    : [];
  const count = typeof body.count === 'number' ? body.count : 0;
  const prefix = body.prefix || 'Tamu Undangan';
  const division = body.division || null;
  const expires_at = body.expires_at || null;
  const admin = c.get('admin');

  const manager = new DefaultGuestPassManager(c.env.DB, c.env);
  const result = await manager.issueGuestPasses({
    eventId,
    guests: rawGuests,
    count,
    prefix,
    division,
    expiresAt: expires_at,
    issuerId: admin?.id,
  });

  if (!result.success || !result.data) {
    const statusCode = result.error?.status_code || 400;
    return c.json<ApiResponse>(
      {
        ok: false,
        error: result.error,
      },
      statusCode
    );
  }

  await invalidateEdgeCache(['agenda', 'members'], c);

  return c.json<ApiResponse>({
    ok: true,
    data: {
      total: result.data.total,
      tokens: result.data.tokens,
    },
  });
};

eventsRoutes.post('/:id/guests', authMiddleware, requireRole(['owner', 'admin']), createGuestPassesHandler);
eventsRoutes.post('/:id/guests/batch', authMiddleware, requireRole(['owner', 'admin']), createGuestPassesHandler);
eventsRoutes.post('/:id/guests/batch-names', authMiddleware, requireRole(['owner', 'admin']), createGuestPassesHandler);

// GET /:id/guest-sources - Get up to 2 most recent previous events with guests for import selection
eventsRoutes.get('/:id/guest-sources', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const eventId = c.req.param('id');
  if (!eventId) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Event ID wajib diisi.' } },
      400
    );
  }

  const eventGuestRepo = new EventGuestRepository(c.env.DB);
  const sources = await eventGuestRepo.listTwoPreviousEventsWithGuests(eventId);

  return c.json<ApiResponse>({
    ok: true,
    data: { sources },
  });
});

// GET /:id/guest-candidates - List candidate guests from a chosen previous event
eventsRoutes.get('/:id/guest-candidates', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const eventId = c.req.param('id');
  if (!eventId) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Event ID wajib diisi.' } },
      400
    );
  }

  const sourceId = c.req.query('source_id');
  if (!sourceId) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'ID kegiatan sumber wajib disertakan.',
        },
      },
      400
    );
  }

  const eventGuestRepo = new EventGuestRepository(c.env.DB);
  const candidates = await eventGuestRepo.listGuestsFromSourceEvent(sourceId, eventId);

  return c.json<ApiResponse>({
    ok: true,
    data: { candidates },
  });
});

// POST /:id/guests/import - Import selected guests from previous event without re-generating QR
eventsRoutes.post('/:id/guests/import', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const eventId = c.req.param('id');
  if (!eventId) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Event ID wajib diisi.' } },
      400
    );
  }

  const body = await c.req.json<{ guest_member_ids?: string[]; source_event_id?: string }>();
  const guestMemberIds = Array.isArray(body.guest_member_ids) ? body.guest_member_ids : [];
  const admin = c.get('admin');

  const manager = new DefaultGuestPassManager(c.env.DB, c.env);
  const result = await manager.importPriorGuests({
    targetEventId: eventId,
    sourceEventId: body.source_event_id,
    guestMemberIds,
    issuerId: admin?.id,
  });

  if (!result.success || !result.data) {
    const statusCode = result.error?.status_code || 400;
    return c.json<ApiResponse>(
      {
        ok: false,
        error: result.error,
      },
      statusCode
    );
  }

  await invalidateEdgeCache(['agenda', 'attendance', 'members'], c);

  return c.json<ApiResponse>({
    ok: true,
    data: {
      imported_count: result.data.imported_count,
      message: result.data.message,
    },
  });
});

// POST /api/events/bulk-close - Bulk close active events
eventsRoutes.post('/bulk-close', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tidak ada kegiatan yang dipilih.' } },
      400
    );
  }

  const admin = c.get('admin');
  const coordinator = new MutationCoordinator(c.env.DB, c);
  const placeholders = ids.map(() => '?').join(',');
  const updateStmt = c.env.DB
    .prepare(`UPDATE events SET status = 'closed', updated_at = datetime('now') WHERE id IN (${placeholders})`)
    .bind(...ids);

  await coordinator.execute({
    statements: [updateStmt],
    cacheTags: ['agenda', 'attendance'],
    audit: {
      adminId: admin?.id,
      action: 'BULK_CLOSE_EVENTS',
      entityType: 'event',
      meta: { count: ids.length, ids },
    },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { count: ids.length, message: `Berhasil menutup ${ids.length} kegiatan.` },
  });
});

// POST /api/events/bulk-delete - Bulk cascade delete events and their temporary guests
eventsRoutes.post('/bulk-delete', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tidak ada kegiatan yang dipilih.' } },
      400
    );
  }

  const eventRepo = new EventRepository(c.env.DB);
  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');

  for (const id of ids) {
    await eventRepo.delete(id);
  }

  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'BULK_DELETE_EVENTS',
    entity_type: 'event',
    meta: { count: ids.length, ids },
  });

  await invalidateEdgeCache(['agenda', 'members'], (c as any).executionCtx);

  return c.json<ApiResponse>({
    ok: true,
    data: { count: ids.length, message: `Berhasil menghapus permanen ${ids.length} kegiatan.` },
  });
});

export { eventsRoutes };
