import { Hono } from 'hono';
import { Env } from '../env';
import { QrTokenRepository } from '../repositories/qr.repo';
import { MemberRepository } from '../repositories/member.repo';
import { EventRepository } from '../repositories/event.repo';
import { AuditRepository } from '../repositories/audit.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { qrGenerateSchema } from '@/shared/schemas/qr.schema';
import { generateQrToken } from '../crypto/qr-crypto';
import { ApiResponse, QrToken } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';

const qrRoutes = new Hono<{ Bindings: Env }>();

// POST /api/qr/generate - Generate QR tokens (Universal or Event)
qrRoutes.post('/generate', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json();
  const input = qrGenerateSchema.parse(body);

  const memberRepo = new MemberRepository(c.env.DB);
  const eventRepo = new EventRepository(c.env.DB);
  const qrRepo = new QrTokenRepository(c.env.DB);
  const auditRepo = new AuditRepository(c.env.DB);

  if (input.scope === 'event' && input.event_id) {
    const event = await eventRepo.findById(input.event_id);
    if (!event) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.EVENT_NOT_FOUND,
            message: 'Event tujuan tidak ditemukan.',
          },
        },
        404
      );
    }
  }

  const members = await memberRepo.findByIds(input.member_ids);
  if (members.length === 0) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.MEMBER_NOT_FOUND,
          message: 'Anggota yang dipilih tidak ditemukan.',
        },
      },
      404
    );
  }

  const admin = c.get('admin');
  const kid = c.env.QR_ACTIVE_KID || 'k1';
  const issuer = c.env.APP_ISSUER || 'https://absen.local';
  const audience = c.env.APP_AUDIENCE || 'ams';

  const generatedTokens: Array<{
    id: string;
    jti: string;
    member_id: string;
    member_name: string;
    member_external_id: string;
    member_division: string | null;
    qr_token: string;
    scope: 'universal' | 'event';
    expires_at: string;
  }> = [];

  const dbTokensToInsert: Array<{
    id: string;
    jti: string;
    member_id: string;
    event_id?: string | null;
    scope: 'universal' | 'event';
    valid_from: string;
    expires_at: string;
    max_uses?: number | null;
    created_by?: string | null;
    note?: string | null;
  }> = [];

  for (const member of members) {
    const id = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const tokenString = await generateQrToken(
      {
        memberId: member.id,
        jti,
        scope: input.scope,
        eventId: input.scope === 'event' ? input.event_id : null,
        validFrom: input.valid_from,
        expiresAt: input.expires_at,
        issuer,
        audience,
        kid,
      },
      c.env
    );

    dbTokensToInsert.push({
      id,
      jti,
      member_id: member.id,
      event_id: input.scope === 'event' ? input.event_id : null,
      scope: input.scope,
      valid_from: input.valid_from,
      expires_at: input.expires_at,
      max_uses: input.max_uses ?? (input.scope === 'event' ? 1 : null),
      created_by: admin?.id,
      note: input.note,
    });

    generatedTokens.push({
      id,
      jti,
      member_id: member.id,
      member_name: member.name,
      member_external_id: member.external_id,
      member_division: member.division,
      qr_token: tokenString,
      scope: input.scope,
      expires_at: input.expires_at,
    });
  }

  await qrRepo.createBatch(dbTokensToInsert);

  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'GENERATE_QR',
    meta: {
      count: generatedTokens.length,
      scope: input.scope,
      event_id: input.event_id,
      expires_at: input.expires_at,
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

// GET /api/qr/event/:id - List QR tokens for event (dynamically attaches JWE only for active/unrevoked tokens)
qrRoutes.get('/event/:id', authMiddleware, async (c) => {
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

  const repo = new QrTokenRepository(c.env.DB);
  const tokens = await repo.listByEvent(eventId);

  const kid = c.env.QR_ACTIVE_KID || 'k1';
  const issuer = c.env.APP_ISSUER || 'https://absen.local';
  const audience = c.env.APP_AUDIENCE || 'ams';

  const tokensWithJwe: QrToken[] = await Promise.all(
    tokens.map(async (tok) => {
      // If token is revoked, do not provide QR string
      if (tok.revoked_at) {
        return { ...tok, qr_token: null };
      }

      try {
        const tokenString = await generateQrToken(
          {
            memberId: tok.member_id,
            jti: tok.jti,
            scope: tok.scope,
            eventId: tok.event_id,
            validFrom: tok.valid_from,
            expiresAt: tok.expires_at,
            issuer,
            audience,
            kid,
          },
          c.env
        );
        return { ...tok, qr_token: tokenString };
      } catch {
        return { ...tok, qr_token: null };
      }
    })
  );

  return c.json<ApiResponse>({
    ok: true,
    data: { tokens: tokensWithJwe },
  });
});

// GET /api/qr/member/:id - List QR tokens for member (dynamically attaches JWE only for active/unrevoked tokens)
qrRoutes.get('/member/:id', authMiddleware, async (c) => {
  const memberId = c.req.param('id');
  if (!memberId) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Member ID wajib diisi.',
        },
      },
      400
    );
  }

  const repo = new QrTokenRepository(c.env.DB);
  const tokens = await repo.listByMember(memberId);

  const kid = c.env.QR_ACTIVE_KID || 'k1';
  const issuer = c.env.APP_ISSUER || 'https://absen.local';
  const audience = c.env.APP_AUDIENCE || 'ams';

  const tokensWithJwe: QrToken[] = await Promise.all(
    tokens.map(async (tok) => {
      if (tok.revoked_at) {
        return { ...tok, qr_token: null };
      }

      try {
        const tokenString = await generateQrToken(
          {
            memberId: tok.member_id,
            jti: tok.jti,
            scope: tok.scope,
            eventId: tok.event_id,
            validFrom: tok.valid_from,
            expiresAt: tok.expires_at,
            issuer,
            audience,
            kid,
          },
          c.env
        );
        return { ...tok, qr_token: tokenString };
      } catch {
        return { ...tok, qr_token: null };
      }
    })
  );

  return c.json<ApiResponse>({
    ok: true,
    data: { tokens: tokensWithJwe },
  });
});

// POST /api/qr/:id/revoke - Revoke QR token
qrRoutes.post('/:id/revoke', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Token ID wajib diisi.',
        },
      },
      400
    );
  }

  const repo = new QrTokenRepository(c.env.DB);
  const success = await repo.revoke(id);

  if (!success) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Token tidak ditemukan atau sudah dicabut sebelumnya.',
        },
      },
      404
    );
  }

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'REVOKE_QR',
    entity_type: 'qr_token',
    entity_id: id,
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { message: 'Token QR berhasil dicabut (revoked).' },
  });
});

// DELETE /api/qr/:id - Permanently delete QR token
qrRoutes.delete('/:id', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Token ID wajib diisi.',
        },
      },
      400
    );
  }

  const repo = new QrTokenRepository(c.env.DB);
  const existing = await repo.findById(id);
  if (!existing) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Token tidak ditemukan.',
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
    action: 'DELETE_QR',
    entity_type: 'qr_token',
    entity_id: id,
    meta: { member_name: existing.member_name, event_name: existing.event_name },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { message: 'Tiket QR berhasil dihapus.' },
  });
});

export { qrRoutes };
