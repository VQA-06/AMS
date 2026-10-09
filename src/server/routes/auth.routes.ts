import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { Env } from '../env';
import { AdminRepository } from '../repositories/admin.repo';
import { MemberRepository } from '../repositories/member.repo';
import { QrTokenRepository } from '../repositories/qr.repo';
import { AuditRepository } from '../repositories/audit.repo';
import {
  adminCreateFromMemberSchema,
  adminUpdateSchema,
  qrLoginSchema,
  loginSchema,
  profileUpdateSchema,
} from '@/shared/schemas/auth.schema';
import {
  authMiddleware,
  requireRole,
  invalidateAdminCache,
  revokeSessionToken,
  revokeAllSessionsForAdmin,
  memorySessionStore,
} from '../middleware/auth';
export { memorySessionStore } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rate-limiter';
import { ApiResponse, Role, Status } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';
import { hashPassword, verifyPassword, verifyPasswordAndCheckUpgrade } from '../crypto/password-crypto';
import { verifyQrToken } from '../crypto/qr-crypto';
import { createSessionToken } from '../crypto/session-crypto';
import { isAllowedOrigin } from '../lib/cors-origin';
const authRoutes = new Hono<{ Bindings: Env }>();

// GET /api/auth/me
authRoutes.get('/me', authMiddleware, async (c) => {
  const admin = c.get('admin');
  return c.json<ApiResponse>({
    ok: true,
    data: { admin },
  });
});

// POST /api/auth/login (Database-Driven Password Authentication with Anti-Brute-Force Rate Limiting & Constant-Time Response)
authRoutes.post('/login', authRateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 }), async (c) => {
  // Enforce strict Content-Type to mitigate login CSRF
  const contentType = c.req.header('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Content-Type harus application/json.',
        },
      },
      415
    );
  }

  // Origin / Referer validation for browser clients
  const origin = c.req.header('origin');
  if (origin && !isAllowedOrigin(origin, c.env)) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Origin tidak diizinkan.',
        },
      },
      403
    );
  }

  const body = await c.req.json();
  const input = loginSchema.parse(body);

  const adminRepo = new AdminRepository(c.env.DB);
  const admin = await adminRepo.findByEmail(input.email);

  // Timing-safe constant-time failure response: Execute dummy password verification if account not found/inactive
  if (!admin || admin.status !== 'active') {
    await verifyPassword(
      input.password,
      '00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000'
    );
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.INVALID_CREDENTIALS,
          message: 'Email atau password salah.',
        },
      },
      401
    );
  }

  // If this admin is linked to a member, verify member is still active
  if (admin.member_id) {
    const memberRepo = new MemberRepository(c.env.DB);
    const member = await memberRepo.findById(admin.member_id);
    if (!member || member.status !== 'active') {
      await adminRepo.deactivateByMemberId(admin.member_id);
      revokeAllSessionsForAdmin(admin.email);
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.INVALID_CREDENTIALS,
            message: 'Email atau password salah.',
          },
        },
        401
      );
    }
  }

  // Verify password from database with automatic upgrade to 100,000 iterations
  if (admin.password_hash) {
    const { valid: isPasswordValid, needsUpgrade } = await verifyPasswordAndCheckUpgrade(
      input.password,
      admin.password_hash
    );
    if (!isPasswordValid) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.INVALID_CREDENTIALS,
            message: 'Email atau password salah.',
          },
        },
        401
      );
    }

    // Transparently upgrade legacy iteration hashes to 100,000 PBKDF2 iterations
    if (needsUpgrade) {
      const upgradedHash = await hashPassword(input.password);
      await adminRepo.update(admin.id, { password_hash: upgradedHash });
    }
  } else {
    // If admin has no password hash set yet, set it from this first login
    const newHash = await hashPassword(input.password);
    await adminRepo.update(admin.id, { password_hash: newHash });
  }

  const sessionToken = await createSessionToken(
    { email: admin.email, role: admin.role },
    c.env.SESSION_SECRET || 'ams-default-session-secret-key-32-chars-minimum'
  );

  if (c.env.KV) {
    try {
      await c.env.KV.put(`session:${sessionToken}`, admin.email, {
        expirationTtl: 60 * 60 * 24 * 7, // 7 days
      });
    } catch {
      // ignore KV put error in dev
    }
  }

  setCookie(c, 'absen_session', sessionToken, {
    path: '/',
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  const auditRepo = new AuditRepository(c.env.DB);
  await auditRepo.logAction({
    admin_id: admin.id,
    action: 'LOGIN',
    entity_type: 'admin',
    entity_id: admin.id,
    meta: { email: admin.email, method: 'password' },
  });

  // Strip password_hash before returning admin object
  const { password_hash: _, ...safeAdmin } = admin as any;

  return c.json<ApiResponse>({
    ok: true,
    data: {
      admin: safeAdmin,
      token: sessionToken,
    },
  });
});

// POST /api/auth/login-qr (QR-Code Based Authentication for Member-Linked Admins with Rate Limiting)
// NOTE: This route ONLY logs the admin in; it DOES NOT record attendance!
authRoutes.post('/login-qr', authRateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 }), async (c) => {
  // Enforce strict Content-Type
  const contentType = c.req.header('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Content-Type harus application/json.',
        },
      },
      415
    );
  }

  // Origin validation for browser clients
  const origin = c.req.header('origin');
  if (origin && !isAllowedOrigin(origin, c.env)) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Origin tidak diizinkan.',
        },
      },
      403
    );
  }

  const body = await c.req.json();
  const input = qrLoginSchema.parse(body);

  // Decrypt and verify QR Token
  let decrypted;
  try {
    const trustedIssuers = c.env.TRUSTED_ISSUERS
      ? c.env.TRUSTED_ISSUERS.split(',').map((s) => s.trim())
      : [
          c.env.APP_ISSUER || 'https://ams.ccunbaja.web.id',
          'https://ams.ccunbaja.web.id',
          'https://ams.humanone.workers.dev',
          'https://absen.local',
        ];

    decrypted = await verifyQrToken(input.qr, {
      expectedIssuer: trustedIssuers,
      expectedAudience: c.env.APP_AUDIENCE || 'ams',
      env: c.env,
    });
  } catch (err) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.TOKEN_INVALID,
          message: 'QR Pass tidak valid, rusak, atau telah kedaluwarsa.',
        },
      },
      401
    );
  }

  const memberId = decrypted.memberId;
  const adminRepo = new AdminRepository(c.env.DB);
  const memberRepo = new MemberRepository(c.env.DB);
  const qrRepo = new QrTokenRepository(c.env.DB);

  // Check if QR token has been revoked in database
  const dbToken = await qrRepo.findByJti(decrypted.jti);
  if (!dbToken || dbToken.revoked_at) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.TOKEN_REVOKED,
          message: 'QR Pass ini telah dicabut atau dinonaktifkan.',
        },
      },
      401
    );
  }
  // Check if member exists and is active
  const member = await memberRepo.findById(memberId);
  if (!member || member.status !== 'active') {
    await adminRepo.deactivateByMemberId(memberId);
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Status keanggotaan Anda tidak aktif. Akses login ditolak.',
        },
      },
      403
    );
  }

  // Find linked admin account
  const admin = await adminRepo.findByMemberId(memberId);
  if (!admin || admin.status !== 'active') {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: `Anggota ${member.name} (${member.external_id}) belum didaftarkan sebagai panitia/tim aktif.`,
        },
      },
      401
    );
  }

  // Create stateless signed session token (0 KV writes, <0.2ms CPU)
  const sessionToken = await createSessionToken(
    { email: admin.email, role: admin.role },
    c.env.SESSION_SECRET || 'ams-default-session-secret-key-32-chars-minimum'
  );
  memorySessionStore.set(sessionToken, admin.email);

  if (c.env.KV) {
    try {
      await c.env.KV.put(`session:${sessionToken}`, admin.email, {
        expirationTtl: 60 * 60 * 24 * 7, // 7 days
      });
    } catch {
      // ignore
    }
  }

  setCookie(c, 'absen_session', sessionToken, {
    path: '/',
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  const auditRepo = new AuditRepository(c.env.DB);
  await auditRepo.logAction({
    admin_id: admin.id,
    action: 'LOGIN_QR',
    entity_type: 'admin',
    entity_id: admin.id,
    meta: { email: admin.email, member_id: member.id, method: 'qr_pass' },
  });

  const { password_hash: _, ...safeAdmin } = admin as any;

  return c.json<ApiResponse>({
    ok: true,
    data: {
      admin: safeAdmin,
      token: sessionToken,
    },
  });
});

// PATCH /api/auth/profile (Update Profile Name, Email, and Password)
authRoutes.patch('/profile', authMiddleware, async (c) => {
  const currentAdmin = c.get('admin');
  const body = await c.req.json();
  const input = profileUpdateSchema.parse(body);

  const adminRepo = new AdminRepository(c.env.DB);
  const dbAdmin = await adminRepo.findById(currentAdmin.id);
  if (!dbAdmin) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.ADMIN_NOT_FOUND,
          message: 'Akun admin tidak ditemukan.',
        },
      },
      404
    );
  }

  const updateData: any = {};

  if (input.name && input.name.trim()) {
    updateData.name = input.name.trim();
  }

  if (input.email && input.email.trim().toLowerCase() !== dbAdmin.email.toLowerCase()) {
    // Enforce re-authentication for email changes
    if (dbAdmin.password_hash) {
      if (!input.current_password) {
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.INVALID_CREDENTIALS,
              message: 'Password saat ini wajib diisi untuk mengubah alamat email.',
            },
          },
          400
        );
      }

      const isCurrentValid = await verifyPassword(input.current_password, dbAdmin.password_hash);
      if (!isCurrentValid) {
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.INVALID_CREDENTIALS,
              message: 'Password saat ini yang Anda masukkan salah.',
            },
          },
          400
        );
      }
    }

    const existing = await adminRepo.findByEmail(input.email);
    if (existing && existing.id !== dbAdmin.id) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Email tersebut sudah digunakan oleh akun lain.',
          },
        },
        400
      );
    }
    updateData.email = input.email.trim().toLowerCase();
  }

  // Handle password change
  if (input.new_password) {
    if (dbAdmin.password_hash) {
      if (!input.current_password) {
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.INVALID_CREDENTIALS,
              message: 'Password saat ini wajib diisi untuk mengubah password.',
            },
          },
          400
        );
      }

      const isCurrentValid = await verifyPassword(input.current_password, dbAdmin.password_hash);
      if (!isCurrentValid) {
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.INVALID_CREDENTIALS,
              message: 'Password saat ini yang Anda masukkan salah.',
            },
          },
          400
        );
      }
    }

    updateData.password_hash = await hashPassword(input.new_password);
  }

  const updated = await adminRepo.update(dbAdmin.id, updateData);
  invalidateAdminCache(dbAdmin.email);
  if (updateData.email && updateData.email !== dbAdmin.email) {
    invalidateAdminCache(updateData.email);
  }

  const auditRepo = new AuditRepository(c.env.DB);
  await auditRepo.logAction({
    admin_id: dbAdmin.id,
    action: 'PROFILE_UPDATED',
    entity_type: 'admin',
    entity_id: dbAdmin.id,
    meta: { fields: Object.keys(updateData) },
  });

  const { password_hash: _, ...safeAdmin } = (updated || dbAdmin) as any;

  return c.json<ApiResponse>({
    ok: true,
    data: { admin: safeAdmin },
  });
});

// POST /api/auth/logout
authRoutes.post('/logout', async (c) => {
  const sessionToken =
    getCookie(c, 'absen_session') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (sessionToken) {
    revokeSessionToken(sessionToken);
    memorySessionStore.delete(sessionToken);
    if (c.env.KV) {
      try {
        await c.env.KV.delete(`session:${sessionToken}`);
        await c.env.KV.put(`revoked:${sessionToken}`, '1', {
          expirationTtl: 60 * 60 * 24 * 7,
        });
      } catch {
        // ignore
      }
    }
  }

  deleteCookie(c, 'absen_session', { path: '/' });
  return c.json<ApiResponse>({
    ok: true,
    data: { message: 'Logged out successfully' },
  });
});

// GET /api/auth/admins (Owner & Admin only)
authRoutes.get('/admins', authMiddleware, requireRole(['owner', 'admin']), async (c) => {
  const adminRepo = new AdminRepository(c.env.DB);
  const admins = await adminRepo.list();
  const safeAdmins = admins.map((a: any) => {
    const { password_hash: _, ...safe } = a;
    return safe;
  });
  return c.json<ApiResponse>({
    ok: true,
    data: { admins: safeAdmins },
  });
});

// POST /api/auth/admins (Create Admin from Active Member - Owner only)
authRoutes.post('/admins', authMiddleware, requireRole(['owner']), async (c) => {
  const body = await c.req.json();
  const input = adminCreateFromMemberSchema.parse(body);

  const memberRepo = new MemberRepository(c.env.DB);
  const member = await memberRepo.findById(input.member_id);
  if (!member || member.status !== 'active') {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.MEMBER_NOT_FOUND,
          message: 'Anggota tidak ditemukan atau berstatus tidak aktif.',
        },
      },
      400
    );
  }

  const adminRepo = new AdminRepository(c.env.DB);
  
  // Check if member already has an admin account
  const existingByMember = await adminRepo.findByMemberId(member.id);
  if (existingByMember) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Anggota ${member.name} (${member.external_id}) sudah memiliki akun panitia/tim.`,
        },
      },
      400
    );
  }

  // Determine email / identifier to use
  const emailToUse = member.email?.trim().toLowerCase() || `${member.external_id.toLowerCase()}@member.ams.cc`;
  const existingByEmail = await adminRepo.findByEmail(emailToUse);
  if (existingByEmail) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Email / identifier ${emailToUse} sudah digunakan oleh akun lain.`,
        },
      },
      400
    );
  }

  const passwordHash = await hashPassword(input.password);

  const created = await adminRepo.create({
    id: `adm_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    member_id: member.id,
    email: emailToUse,
    name: member.name,
    role: input.role,
    status: 'active',
    password_hash: passwordHash,
  });

  const auditRepo = new AuditRepository(c.env.DB);
  const currentAdmin = c.get('admin');
  await auditRepo.logAction({
    admin_id: currentAdmin.id,
    action: 'ADMIN_CREATED',
    entity_type: 'admin',
    entity_id: created.id,
    meta: { email: created.email, member_id: member.id, role: input.role },
  });

  const { password_hash: _, ...safeCreated } = created as any;

  return c.json<ApiResponse>({
    ok: true,
    data: { admin: safeCreated },
  });
});

// PATCH /api/auth/admins/:id (Update Team Member Role / Status / Password - Owner only)
authRoutes.patch('/admins/:id', authMiddleware, requireRole(['owner']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Admin ID wajib diisi.',
        },
      },
      400
    );
  }

  const body = await c.req.json();
  const input = adminUpdateSchema.parse(body);

  const adminRepo = new AdminRepository(c.env.DB);
  const targetAdmin = await adminRepo.findById(id);
  if (!targetAdmin) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.ADMIN_NOT_FOUND,
          message: 'Akun panitia tidak ditemukan.',
        },
      },
      404
    );
  }

  // Prevent deactivating default owner
  if (targetAdmin.id === 'adm_owner_default' && input.status === 'inactive') {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Akun default owner sistem tidak dapat dinonaktifkan.',
        },
      },
      400
    );
  }

  const updateData: any = {};
  if (input.role) updateData.role = input.role;
  if (input.status) {
    updateData.status = input.status;
    if (input.status === 'inactive') {
      revokeAllSessionsForAdmin(targetAdmin.email);
    }
  }
  if (input.password) {
    updateData.password_hash = await hashPassword(input.password);
    revokeAllSessionsForAdmin(targetAdmin.email);
  }

  const updated = await adminRepo.update(id, updateData);
  invalidateAdminCache(targetAdmin.email);
  if (updateData.email && updateData.email !== targetAdmin.email) {
    revokeAllSessionsForAdmin(targetAdmin.email);
    invalidateAdminCache(updateData.email);
  }
  const auditRepo = new AuditRepository(c.env.DB);
  const currentAdmin = c.get('admin');
  await auditRepo.logAction({
    admin_id: currentAdmin.id,
    action: 'ADMIN_UPDATED',
    entity_type: 'admin',
    entity_id: id,
    meta: { fields: Object.keys(updateData) },
  });

  const { password_hash: _, ...safeUpdated } = (updated || targetAdmin) as any;

  return c.json<ApiResponse>({
    ok: true,
    data: { admin: safeUpdated },
  });
});

// DELETE /api/auth/admins/:id (Delete Team Member - Owner only)
authRoutes.delete('/admins/:id', authMiddleware, requireRole(['owner']), async (c) => {
  const id = c.req.param('id');
  if (!id) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Admin ID wajib diisi.',
        },
      },
      400
    );
  }

  const currentAdmin = c.get('admin');

  if (id === 'adm_owner_default') {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Akun Default Owner sistem dilindungi dan tidak dapat dihapus.',
        },
      },
      403
    );
  }

  if (id === currentAdmin.id) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.',
        },
      },
      400
    );
  }

  const adminRepo = new AdminRepository(c.env.DB);
  const targetAdmin = await adminRepo.findById(id);
  if (!targetAdmin) {
    return c.json<ApiResponse>(
      {
        ok: false,
        error: {
          code: ErrorCode.ADMIN_NOT_FOUND,
          message: 'Akun panitia tidak ditemukan.',
        },
      },
      404
    );
  }
  await adminRepo.delete(id);
  revokeAllSessionsForAdmin(targetAdmin.email);
  invalidateAdminCache(targetAdmin.email);
  const auditRepo = new AuditRepository(c.env.DB);
  await auditRepo.logAction({
    action: 'ADMIN_DELETED',
    entity_type: 'admin',
    entity_id: id,
    meta: { email: targetAdmin.email, name: targetAdmin.name, role: targetAdmin.role },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { message: `Akun panitia ${targetAdmin.name} berhasil dihapus permanen.` },
  });
});

/**
 * Single source of truth for admin bulk-delete protection. An admin can never
 * delete their own account, and the default master owner (role `owner` with no
 * linked `member_id`) can never be deleted through any path. The
 * `POST /admins/bulk-delete` loop is the only caller.
 */
export function canDeleteAdmin(
  currentAdminId: string,
  target: { id: string; role: string; member_id?: string | null }
): boolean {
  // Protect self
  if (target.id === currentAdminId) return false;
  // Protect owner account if owner deletion is restricted
  if (target.role === 'owner' && target.member_id === null) return false;
  return true;
}

// POST /api/auth/admins/bulk-delete - Bulk delete team accounts (protects current admin & default owner)
authRoutes.post('/admins/bulk-delete', authMiddleware, requireRole(['owner']), async (c) => {
  const currentAdmin = c.get('admin');
  const body = await c.req.json<{ ids: string[] }>();
  const ids = Array.isArray(body.ids) ? body.ids : [];

  if (ids.length === 0) {
    return c.json<ApiResponse>(
      { ok: false, error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tidak ada akun yang dipilih.' } },
      400
    );
  }

  const adminRepo = new AdminRepository(c.env.DB);
  const auditRepo = new AuditRepository(c.env.DB);

  let deletedCount = 0;
  for (const id of ids) {
    const target = await adminRepo.findById(id);
    if (!target) continue;
    // Protection rule lives in canDeleteAdmin so it is testable at source.
    if (!canDeleteAdmin(currentAdmin.id, target)) continue;

    await adminRepo.delete(id);
    revokeAllSessionsForAdmin(target.email);
    invalidateAdminCache(target.email);
    deletedCount++;
  }

  await auditRepo.logAction({
    admin_id: currentAdmin.id,
    action: 'BULK_DELETE_ADMINS',
    entity_type: 'admin',
    meta: { deletedCount, ids },
  });

  return c.json<ApiResponse>({
    ok: true,
    data: { count: deletedCount, message: `Berhasil menghapus ${deletedCount} akun tim.` },
  });
});

export { authRoutes };
