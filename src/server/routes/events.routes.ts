import { Hono } from 'hono';
import { Env } from '../env';
import { EventRepository } from '../repositories/event.repo';
import { MemberRepository } from '../repositories/member.repo';
import { QrTokenRepository } from '../repositories/qr.repo';
import { AuditRepository } from '../repositories/audit.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { eventSchema, eventUpdateSchema } from '@/shared/schemas/event.schema';
import { generateQrToken } from '../crypto/qr-crypto';
import { ApiResponse, Event } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';

const eventsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/events - List events
eventsRoutes.get('/', authMiddleware, async (c) => {
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
    session_modes: JSON.stringify(input.session_modes),
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

  return c.json<ApiResponse>({
    ok: true,
    data: { event: created },
  });
});

// GET /api/events/analytics/top-attendance - Get attendance rankings
eventsRoutes.get('/analytics/top-attendance', authMiddleware, async (c) => {
  const repo = new EventRepository(c.env.DB);
  const events = await repo.getTopAttendanceEvents();

  return c.json<ApiResponse>({
    ok: true,
    data: { events },
  });
});

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
    session_modes: input.session_modes ? JSON.stringify(input.session_modes) : undefined,
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

  return c.json<ApiResponse>({
    ok: true,
    data: { message: 'Kegiatan berhasil dihapus.' },
  });
});

// POST /api/events/:id/guests - Create temporary guest participants & generate event QR passes
eventsRoutes.post('/:id/guests', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
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

  const eventRepo = new EventRepository(c.env.DB);
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

  const body = await c.req.json();
  const {
    guests = [],
    count = 0,
    prefix = 'Tamu Undangan',
    division = null,
    expires_at = null,
  } = body as {
    guests?: Array<{ name: string; division?: string | null; email?: string | null; phone?: string | null }>;
    count?: number;
    prefix?: string;
    division?: string | null;
    expires_at?: string | null;
  };

  const guestList: Array<{ name: string; division?: string | null; email?: string | null; phone?: string | null }> = [];

  if (Array.isArray(guests) && guests.length > 0) {
    for (const g of guests) {
      if (g.name && g.name.trim() !== '') {
        guestList.push({
          name: g.name.trim(),
          division: g.division?.trim() || division || null,
          email: g.email?.trim() || null,
          phone: g.phone?.trim() || null,
        });
      }
    }
  } else if (count > 0) {
    const totalCount = Math.min(100, count);
    for (let i = 1; i <= totalCount; i++) {
      const padNum = String(i).padStart(2, '0');
      guestList.push({
        name: `${prefix} #${padNum}`,
        division: division || 'Tamu',
        email: null,
        phone: null,
      });
    }
  }

  if (guestList.length === 0) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Daftar nama atau jumlah tiket tamu tidak boleh kosong.',
        },
      },
      400
    );
  }

  const memberRepo = new MemberRepository(c.env.DB);
  const qrRepo = new QrTokenRepository(c.env.DB);
  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');

  const kid = c.env.QR_ACTIVE_KID || 'k1';
  const issuer = c.env.APP_ISSUER || 'https://absen.local';
  const audience = c.env.APP_AUDIENCE || 'ams';
  const validFrom = new Date().toISOString();
  const tokenExpiresAt =
    expires_at ||
    (event.ends_at
      ? new Date(new Date(event.ends_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

  const generatedTokens: Array<{
    id: string;
    jti: string;
    member_id: string;
    member_name: string;
    member_external_id: string;
    member_division: string | null;
    qr_token: string;
    scope: 'event';
    expires_at: string;
  }> = [];

  const dbTokensToInsert: Array<{
    id: string;
    jti: string;
    member_id: string;
    event_id: string;
    scope: 'event';
    valid_from: string;
    expires_at: string;
    max_uses?: number | null;
    created_by?: string | null;
    note?: string | null;
  }> = [];

  for (const guest of guestList) {
    // Generate distinct external_id for guest
    const guestExternalId = `GUEST-${Math.floor(100000 + Math.random() * 900000)}`;

    const member = await memberRepo.create({
      external_id: guestExternalId,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      group_name: `Tamu: ${event.name}`,
      division: guest.division,
      status: 'active',
      metadata: JSON.stringify({ temporary: true, event_id: event.id }),
    });

    const tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const tokenString = await generateQrToken(
      {
        memberId: member.id,
        jti,
        scope: 'event',
        eventId: event.id,
        validFrom,
        expiresAt: tokenExpiresAt,
        issuer,
        audience,
        kid,
      },
      c.env
    );

    dbTokensToInsert.push({
      id: tokenId,
      jti,
      member_id: member.id,
      event_id: event.id,
      scope: 'event',
      valid_from: validFrom,
      expires_at: tokenExpiresAt,
      max_uses: 1,
      created_by: admin?.id,
      note: `Guest Pass untuk ${event.name}`,
    });

    generatedTokens.push({
      id: tokenId,
      jti,
      member_id: member.id,
      member_name: member.name,
      member_external_id: member.external_id,
      member_division: member.division,
      qr_token: tokenString,
      scope: 'event',
      expires_at: tokenExpiresAt,
    });
  }

  await qrRepo.createBatch(dbTokensToInsert);

  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'CREATE_EVENT_GUEST_PASSES',
    entity_type: 'event',
    entity_id: event.id,
    meta: {
      count: generatedTokens.length,
      event_name: event.name,
    },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: {
      total: generatedTokens.length,
      tokens: generatedTokens,
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

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');

  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB
    .prepare(`UPDATE events SET status = 'closed', updated_at = datetime('now') WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();

  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'BULK_CLOSE_EVENTS',
    entity_type: 'event',
    meta: { count: ids.length, ids },
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

  return c.json<ApiResponse>({
    ok: true,
    data: { count: ids.length, message: `Berhasil menghapus permanen ${ids.length} kegiatan.` },
  });
});

export { eventsRoutes };
