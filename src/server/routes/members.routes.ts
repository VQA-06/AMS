import { Hono, Context } from 'hono';
import Papa from 'papaparse';
import { Env } from '../env';
import { MemberRepository } from '../repositories/member.repo';
import { AdminRepository } from '../repositories/admin.repo';
import { QrTokenRepository } from '../repositories/qr.repo';
import { AuditRepository } from '../repositories/audit.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { memberSchema, memberUpdateSchema, memberImportRowSchema } from '@/shared/schemas/member.schema';
import { generateQrToken } from '../crypto/qr-crypto';
import { ApiResponse, Member, QrToken } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';
import { sanitizeCsvRow } from '../lib/csv-sanitizer';

const membersRoutes = new Hono<{ Bindings: Env }>();

// GET /api/members - List members (excludes temporary guest members by default)
membersRoutes.get('/', authMiddleware, async (c) => {
  const query = c.req.query();
  const repo = new MemberRepository(c.env.DB);

  const result = await repo.list({
    search: query.search,
    group_name: query.group_name,
    division: query.division,
    status: (query.status as any) || 'all',
    exclude_temporary: query.include_temporary !== 'true',
    page: query.page ? parseInt(query.page, 10) : 1,
    limit: query.limit ? parseInt(query.limit, 10) : 50,
  });

  return c.json<ApiResponse>({
    ok: true,
    data: result,
  });
});

// GET /api/members/divisions - Get distinct division list
membersRoutes.get('/divisions', authMiddleware, async (c) => {
  const repo = new MemberRepository(c.env.DB);
  const divisions = await repo.getDivisions();
  return c.json<ApiResponse>({
    ok: true,
    data: { divisions },
  });
});

// GET /api/members/groups - Get distinct group list
membersRoutes.get('/groups', authMiddleware, async (c) => {
  const repo = new MemberRepository(c.env.DB);
  const groups = await repo.getGroups();
  return c.json<ApiResponse>({
    ok: true,
    data: { groups },
  });
});

// GET /stats/yearly-recap & /reports/yearly & /analytics/yearly-stats - Get yearly member growth stats
const getYearlyStatsHandler = async (c: Context<{ Bindings: Env }>) => {
  const repo = new MemberRepository(c.env.DB);
  const stats = await repo.getYearlyStats();
  return c.json<ApiResponse>({
    ok: true,
    data: { stats },
  });
};
membersRoutes.get('/stats/yearly-recap', authMiddleware, getYearlyStatsHandler);
membersRoutes.get('/stats/yearly', authMiddleware, getYearlyStatsHandler);
membersRoutes.get('/reports/yearly', authMiddleware, getYearlyStatsHandler);
membersRoutes.get('/analytics/yearly-stats', authMiddleware, getYearlyStatsHandler);

// GET /api/members/universal-tokens - Get or generate universal QR tokens for all active members (Bulk download/print)
membersRoutes.get('/universal-tokens', authMiddleware, async (c) => {
  const memberRepo = new MemberRepository(c.env.DB);
  const qrRepo = new QrTokenRepository(c.env.DB);

  const { members } = await memberRepo.list({
    status: 'active',
    exclude_temporary: true,
    limit: 5000,
  });

  const kid = c.env.QR_ACTIVE_KID || 'k1';
  const issuer = c.env.APP_ISSUER || 'https://absen.local';
  const audience = c.env.APP_AUDIENCE || 'ams';
  const validFrom = new Date().toISOString();
  // Universal Member QR is perpetual (valid as long as member is active)
  const defaultExp = '2099-12-31T23:59:59.999Z';

  const tokens: Array<{
    id: string;
    member_id: string;
    member_name: string;
    member_external_id: string;
    member_division: string | null;
    qr_token: string;
    scope: 'universal';
    expires_at: string;
  }> = [];

  for (const member of members) {
    const existingTokens = await qrRepo.listByMember(member.id);
    const activeUniversal = existingTokens.find(
      (t) => t.scope === 'universal' && !t.revoked_at
    );

    let jti: string;
    let expiresAt: string;
    let tokenId: string;

    if (activeUniversal) {
      tokenId = activeUniversal.id;
      jti = activeUniversal.jti;
      expiresAt = activeUniversal.expires_at;
    } else {
      tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      expiresAt = defaultExp;

      await qrRepo.create({
        id: tokenId,
        jti,
        member_id: member.id,
        scope: 'universal',
        valid_from: validFrom,
        expires_at: expiresAt,
        note: 'Auto-generated Universal Pass',
      });
    }

    const tokenString = await generateQrToken(
      {
        memberId: member.id,
        jti,
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer,
        audience,
        kid,
      },
      c.env
    );

    tokens.push({
      id: tokenId,
      member_id: member.id,
      member_name: member.name,
      member_external_id: member.external_id,
      member_division: member.division,
      qr_token: tokenString,
      scope: 'universal',
      expires_at: expiresAt,
    });
  }

  return c.json<ApiResponse>({
    ok: true,
    data: {
      tokens,
      total: tokens.length,
    },
  });
});

// GET /api/members/:id/universal-qr - Get or generate perpetual universal QR token for a single member
membersRoutes.get('/:id/universal-qr', authMiddleware, async (c) => {
  const memberId = c.req.param('id') || '';
  const memberRepo = new MemberRepository(c.env.DB);
  const member = await memberRepo.findById(memberId);

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

  const qrRepo = new QrTokenRepository(c.env.DB);
  const existingTokens = await qrRepo.listByMember(member.id);
  const activeUniversal = existingTokens.find(
    (t) => t.scope === 'universal' && !t.revoked_at
  );

  const kid = c.env.QR_ACTIVE_KID || 'k1';
  const issuer = c.env.APP_ISSUER || 'https://absen.local';
  const audience = c.env.APP_AUDIENCE || 'ams';
  const validFrom = new Date().toISOString();
  // Universal Member QR is perpetual (valid as long as member is active)
  const defaultExp = '2099-12-31T23:59:59.999Z';

  let jti: string;
  let expiresAt: string;
  let tokenId: string;

  if (activeUniversal) {
    tokenId = activeUniversal.id;
    jti = activeUniversal.jti;
    expiresAt = activeUniversal.expires_at;
  } else {
    tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    expiresAt = defaultExp;

    await qrRepo.create({
      id: tokenId,
      jti,
      member_id: member.id,
      scope: 'universal',
      valid_from: validFrom,
      expires_at: expiresAt,
      note: 'Auto-generated Universal Pass',
    });
  }

  const tokenString = await generateQrToken(
    {
      memberId: member.id,
      jti,
      scope: 'universal',
      validFrom,
      expiresAt,
      issuer,
      audience,
      kid,
    },
    c.env
  );

  return c.json<ApiResponse>({
    ok: true,
    data: {
      token: {
        id: tokenId,
        jti,
        member_id: member.id,
        member_name: member.name,
        member_external_id: member.external_id,
        member_division: member.division,
        qr_token: tokenString,
        scope: 'universal',
        expires_at: expiresAt,
      },
    },
  });
});

// GET /api/members/template.csv - Download CSV template with division column
membersRoutes.get('/template.csv', async (c) => {
  const csvContent = `external_id,name,email,phone,group_name,division,status,metadata\n` +
    `M001,Budi Santoso,budi@example.com,081234567890,Panitia Inti,Acara,active,"{}"\n` +
    `M002,Siti Rahma,siti@example.com,081298765432,Peserta,Logistik,active,"{""kelas"":""12A""}"\n` +
    `M003,Ahmad Fauzi,,,Peserta,,active,"{}"\n`;

  return c.text(csvContent, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="member_template.csv"',
  });
});

// POST /api/members - Create member
membersRoutes.post('/', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json();
  const input = memberSchema.parse(body);

  const repo = new MemberRepository(c.env.DB);
  if (input.external_id && input.external_id.trim() !== '') {
    const existing = await repo.findByExternalId(input.external_id);
    if (existing) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.EXTERNAL_ID_TAKEN,
            message: `Kode Anggota "${input.external_id}" sudah digunakan.`,
          },
        },
        400
      );
    }
  }

  const created = await repo.create({
    external_id: input.external_id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    group_name: input.group_name,
    division: input.division,
    status: input.status,
    metadata: typeof input.metadata === 'object' ? JSON.stringify(input.metadata) : input.metadata || '{}',
  });

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'CREATE_MEMBER',
    entity_type: 'member',
    entity_id: created.id,
    meta: { external_id: created.external_id, name: created.name, division: created.division },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { member: created },
  });
});

// GET /api/members/:id - Detail member
membersRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const repo = new MemberRepository(c.env.DB);
  const member = await repo.findById(id);

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

  return c.json<ApiResponse>({
    ok: true,
    data: { member },
  });
});

// PATCH /api/members/:id - Update member
membersRoutes.patch('/:id', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const body = await c.req.json();
  const input = memberUpdateSchema.parse(body);

  const repo = new MemberRepository(c.env.DB);
  const existing = await repo.findById(id);
  if (!existing) {
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

  if (input.external_id && input.external_id !== existing.external_id) {
    const duplicate = await repo.findByExternalId(input.external_id);
    if (duplicate) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.EXTERNAL_ID_TAKEN,
            message: `Kode Anggota "${input.external_id}" sudah digunakan.`,
          },
        },
        400
      );
    }
  }

  const updated = await repo.update(id, {
    external_id: input.external_id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    group_name: input.group_name,
    division: input.division,
    status: input.status,
    metadata: input.metadata ? (typeof input.metadata === 'object' ? JSON.stringify(input.metadata) : input.metadata) : undefined,
  });

  // If member is marked inactive, automatically deactivate any linked admin account
  if (input.status === 'inactive') {
    const adminRepo = new AdminRepository(c.env.DB);
    await adminRepo.deactivateByMemberId(id);
  }

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'UPDATE_MEMBER',
    entity_type: 'member',
    entity_id: id,
    meta: { changes: input },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { member: updated },
  });
});

// DELETE /api/members/:id - Permanently delete member and associated data
membersRoutes.delete('/:id', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
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

  const repo = new MemberRepository(c.env.DB);
  const existing = await repo.findById(id);
  if (!existing) {
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

  // Delete any linked admin account
  const adminRepo = new AdminRepository(c.env.DB);
  await adminRepo.deleteByMemberId(id);

  await repo.delete(id);

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'DELETE_MEMBER',
    entity_type: 'member',
    entity_id: id,
    meta: { external_id: existing.external_id, name: existing.name },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { message: 'Anggota berhasil dihapus secara permanen.' },
  });
});

// POST /api/members/import - Import members (Preview or Commit)
membersRoutes.post('/import', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json();
  const { mode = 'upsert', preview = false, rows = [] } = body as {
    mode: 'create' | 'update' | 'upsert';
    preview?: boolean;
    rows: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Data anggota untuk diimpor tidak boleh kosong.',
        },
      },
      400
    );
  }

  const repo = new MemberRepository(c.env.DB);
  const validationResults: Array<{
    row: number;
    valid: boolean;
    data?: Record<string, unknown>;
    errors?: Array<{ field: string; message: string }>;
  }> = [];

  const validRowsToCommit: Array<{
    external_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    group_name: string | null;
    division: string | null;
    status: 'active' | 'inactive';
    metadata: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const parseResult = memberImportRowSchema.safeParse(rawRow);

    if (parseResult.success) {
      const data = parseResult.data;
      validationResults.push({
        row: i + 1,
        valid: true,
        data: {
          external_id: data.external_id,
          name: data.name,
          email: data.email ?? null,
          phone: data.phone ?? null,
          group_name: data.group_name ?? null,
          division: data.division ?? null,
          status: data.status,
          metadata: data.metadata ?? '{}',
        },
      });

      validRowsToCommit.push({
        external_id: data.external_id,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        group_name: data.group_name ?? null,
        division: data.division ?? null,
        status: data.status as 'active' | 'inactive',
        metadata: data.metadata ?? '{}',
      });
    } else {
      validationResults.push({
        row: i + 1,
        valid: false,
        data: rawRow,
        errors: parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
  }

  // If preview mode, return validation report only
  if (preview) {
    return c.json<ApiResponse>({
      ok: true,
      data: {
        total: rows.length,
        validCount: validRowsToCommit.length,
        invalidCount: rows.length - validRowsToCommit.length,
        results: validationResults,
      },
    });
  }

  // Commit mode
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of validRowsToCommit) {
    try {
      const existing = await repo.findByExternalId(row.external_id);
      if (existing) {
        if (mode === 'create') {
          skipped++;
        } else {
          await repo.update(existing.id, row);
          updated++;
        }
      } else {
        if (mode === 'update') {
          skipped++;
        } else {
          await repo.create(row);
          created++;
        }
      }
    } catch {
      failed++;
    }
  }

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');
  await auditRepo.logAction({
    admin_id: admin?.id,
    action: 'IMPORT_MEMBERS',
    meta: { total: rows.length, created, updated, skipped, failed, mode },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: {
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
    },
  });
});

// GET /api/members/export - Export members (CSV or JSON)
membersRoutes.get('/export', authMiddleware, requireRole(['owner', 'admin', 'auditor']), async (c) => {
  const query = c.req.query();
  const format = query.format === 'json' ? 'json' : 'csv';
  const repo = new MemberRepository(c.env.DB);

  const result = await repo.list({
    search: query.search,
    group_name: query.group_name,
    division: query.division,
    status: (query.status as any) || 'all',
    exclude_temporary: true,
    limit: 10000,
  });

  if (format === 'json') {
    return c.json<ApiResponse>({
      ok: true,
      data: {
        members: result.members,
      },
    });
  }

  // Generate CSV with formula sanitization
  const csvData = result.members.map((m) =>
    sanitizeCsvRow({
      external_id: m.external_id,
      name: m.name,
      email: m.email || '',
      phone: m.phone || '',
      group_name: m.group_name || '',
      division: m.division || '',
      status: m.status,
      metadata: typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata || {}),
      created_at: m.created_at,
      updated_at: m.updated_at,
    })
  );

  const csvString = Papa.unparse(csvData);

  return c.text(csvString, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="members_${new Date().toISOString().slice(0, 10)}.csv"`,
  });
});

// POST /api/members/cleanup-guests - Delete all temporary guest participant records
membersRoutes.post('/cleanup-guests', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const repo = new MemberRepository(c.env.DB);
  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');

  const deletedCount = await repo.cleanupAllGuestMembers();

  await auditRepo.logAction({
    admin_id: admin?.id || null,
    action: 'CLEANUP_GUEST_MEMBERS',
    entity_type: 'member',
    entity_id: null,
    meta: {
      deletedCount,
      cleanedAt: new Date().toISOString(),
    },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: {
      deletedCount,
      message: `Berhasil menghapus ${deletedCount} data anggota sementara/tamu.`,
    },
  });
});

// POST /api/members/bulk-deactivate - Bulk deactivate members
membersRoutes.post('/bulk-deactivate', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tidak ada anggota yang dipilih.' } },
      400
    );
  }

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');

  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB
    .prepare(`UPDATE members SET status = 'inactive', updated_at = datetime('now') WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();

  await auditRepo.logAction({
    admin_id: admin?.id || null,
    action: 'BULK_DEACTIVATE_MEMBERS',
    entity_type: 'member',
    meta: { count: ids.length, ids },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { count: ids.length, message: `Berhasil menonaktifkan ${ids.length} anggota.` },
  });
});

// POST /api/members/bulk-delete - Bulk delete members and associated data
membersRoutes.post('/bulk-delete', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tidak ada anggota yang dipilih.' } },
      400
    );
  }

  const auditRepo = new AuditRepository(c.env.DB);
  const admin = c.get('admin');

  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM attendances WHERE member_id IN (${placeholders})`).bind(...ids),
    c.env.DB.prepare(`DELETE FROM scan_attempts WHERE member_id IN (${placeholders})`).bind(...ids),
    c.env.DB.prepare(`DELETE FROM qr_tokens WHERE member_id IN (${placeholders})`).bind(...ids),
    c.env.DB.prepare(`DELETE FROM members WHERE id IN (${placeholders})`).bind(...ids),
  ]);

  await auditRepo.logAction({
    admin_id: admin?.id || null,
    action: 'BULK_DELETE_MEMBERS',
    entity_type: 'member',
    meta: { count: ids.length, ids },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { count: ids.length, message: `Berhasil menghapus permanen ${ids.length} anggota.` },
  });
});

// POST /api/members/bulk-tokens - Get or generate perpetual universal tokens for selected members
membersRoutes.post('/bulk-tokens', authMiddleware, async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tidak ada anggota yang dipilih.' } },
      400
    );
  }

  const memberRepo = new MemberRepository(c.env.DB);
  const qrRepo = new QrTokenRepository(c.env.DB);
  const members = await memberRepo.findByIds(ids);

  const kid = c.env.QR_ACTIVE_KID || 'k1';
  const issuer = c.env.APP_ISSUER || 'https://absen.local';
  const audience = c.env.APP_AUDIENCE || 'ams';
  const validFrom = new Date().toISOString();
  const defaultExp = '2099-12-31T23:59:59.999Z';

  const tokens: Array<{
    id: string;
    member_id: string;
    member_name: string;
    member_external_id: string;
    member_division: string | null;
    qr_token: string;
    scope: 'universal';
    expires_at: string;
  }> = [];

  for (const member of members) {
    const existingTokens = await qrRepo.listByMember(member.id);
    const activeUniversal = existingTokens.find(
      (t) => t.scope === 'universal' && !t.revoked_at
    );

    let jti: string;
    let expiresAt: string;
    let tokenId: string;

    if (activeUniversal) {
      tokenId = activeUniversal.id;
      jti = activeUniversal.jti;
      expiresAt = activeUniversal.expires_at;
    } else {
      tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      expiresAt = defaultExp;

      await qrRepo.create({
        id: tokenId,
        jti,
        member_id: member.id,
        scope: 'universal',
        valid_from: validFrom,
        expires_at: expiresAt,
        note: 'Auto-generated Universal Pass',
      });
    }

    const tokenString = await generateQrToken(
      {
        memberId: member.id,
        jti,
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer,
        audience,
        kid,
      },
      c.env
    );

    tokens.push({
      id: tokenId,
      member_id: member.id,
      member_name: member.name,
      member_external_id: member.external_id,
      member_division: member.division,
      qr_token: tokenString,
      scope: 'universal',
      expires_at: expiresAt,
    });
  }

  return c.json<ApiResponse>({
    ok: true,
    data: {
      tokens,
      total: tokens.length,
    },
  });
});

// POST /api/members/:id/promote-guest - Promote a single guest to official permanent member
membersRoutes.post(
  '/:id/promote-guest',
  authMiddleware,
  requireRole(['owner', 'admin']),
  async (c) => {
    const id = c.req.param('id') || '';
    const body = await c.req.json().catch(() => ({}));
    const { division, new_external_id, group_name } = body;

    const repo = new MemberRepository(c.env.DB);
    const existing = await repo.findById(id);

    if (!existing) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.MEMBER_NOT_FOUND,
            message: 'Data tamu tidak ditemukan.',
          },
        },
        404
      );
    }

    const promoted = await repo.promoteGuest(id, {
      newExternalId: new_external_id,
      division,
      groupName: group_name,
    });

    if (!promoted) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Gagal mengangkat tamu menjadi anggota resmi.',
          },
        },
        500
      );
    }

    // Generate Universal Perpetual QR Token for this newly promoted member
    const qrRepo = new QrTokenRepository(c.env.DB);
    const existingTokens = await qrRepo.listByMember(promoted.id);
    let activeUniversal = existingTokens.find(
      (t) => t.scope === 'universal' && !t.revoked_at
    );

    const validFrom = new Date().toISOString();
    const defaultExp = '2099-12-31T23:59:59.999Z';
    const kid = c.env.QR_ACTIVE_KID || 'k1';
    const issuer = c.env.APP_ISSUER || 'https://absen.local';
    const audience = c.env.APP_AUDIENCE || 'ams';

    let tokenId: string;
    let jti: string;
    let expiresAt: string;

    if (activeUniversal) {
      tokenId = activeUniversal.id;
      jti = activeUniversal.jti;
      expiresAt = activeUniversal.expires_at;
    } else {
      tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      expiresAt = defaultExp;

      await qrRepo.create({
        id: tokenId,
        jti,
        member_id: promoted.id,
        scope: 'universal',
        valid_from: validFrom,
        expires_at: expiresAt,
        note: 'Universal Pass from Guest Promotion',
      });
    }

    const tokenString = await generateQrToken(
      {
        memberId: promoted.id,
        jti,
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer,
        audience,
        kid,
      },
      c.env
    );

    // Log audit
    const auditRepo = new AuditRepository(c.env.DB);
    const admin = c.get('admin');
    await auditRepo.logAction({
      admin_id: admin?.id,
      action: 'PROMOTE_GUEST_TO_MEMBER',
      entity_type: 'member',
      entity_id: promoted.id,
      meta: {
        old_external_id: existing.external_id,
        new_external_id: promoted.external_id,
        name: promoted.name,
        division: promoted.division,
      },
    });

    return c.json<ApiResponse>({
      ok: true,
      data: {
        member: promoted,
        universal_token: {
          id: tokenId,
          member_id: promoted.id,
          member_name: promoted.name,
          member_external_id: promoted.external_id,
          member_division: promoted.division,
          qr_token: tokenString,
          scope: 'universal',
          expires_at: expiresAt,
        },
      },
    });
  }
);

// POST /api/members/bulk-promote-guests - Promote multiple guests to official members
membersRoutes.post(
  '/bulk-promote-guests',
  authMiddleware,
  requireRole(['owner', 'admin']),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { ids, division } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Daftar ID tamu (ids) wajib diisi.',
          },
        },
        400
      );
    }

    const repo = new MemberRepository(c.env.DB);
    const qrRepo = new QrTokenRepository(c.env.DB);
    const validFrom = new Date().toISOString();
    const defaultExp = '2099-12-31T23:59:59.999Z';
    const kid = c.env.QR_ACTIVE_KID || 'k1';
    const issuer = c.env.APP_ISSUER || 'https://absen.local';
    const audience = c.env.APP_AUDIENCE || 'ams';

    const { count, promoted } = await repo.bulkPromoteGuests(ids, division);

    // Create perpetual universal pass for each promoted member
    for (const mem of promoted) {
      const existingTokens = await qrRepo.listByMember(mem.id);
      const activeUniversal = existingTokens.find(
        (t) => t.scope === 'universal' && !t.revoked_at
      );

      if (!activeUniversal) {
        const tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        await qrRepo.create({
          id: tokenId,
          jti,
          member_id: mem.id,
          scope: 'universal',
          valid_from: validFrom,
          expires_at: defaultExp,
          note: 'Bulk Promoted Universal Pass',
        });
      }
    }

    // Log audit
    const auditRepo = new AuditRepository(c.env.DB);
    const admin = c.get('admin');
    await auditRepo.logAction({
      admin_id: admin?.id,
      action: 'BULK_PROMOTE_GUESTS',
      entity_type: 'member',
      entity_id: 'bulk',
      meta: { count, promoted_ids: promoted.map((m) => m.id), division },
    });

    return c.json<ApiResponse>({
      ok: true,
      data: {
        count,
        promoted,
      },
    });
  }
);

export { membersRoutes };
