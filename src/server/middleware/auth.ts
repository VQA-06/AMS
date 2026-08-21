import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../env';
import { AdminRepository } from '../repositories/admin.repo';
import { MemberRepository } from '../repositories/member.repo';
import { memorySessionStore } from '../routes/auth.routes';
import { Admin, ApiResponse, Role } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';
import { verifySessionToken } from '../crypto/session-crypto';

declare module 'hono' {
  interface ContextVariableMap {
    admin: Admin;
  }
}

// In-memory flag to prevent repeated SELECT COUNT(*) FROM admins on every unauthenticated request
let hasCheckedDefaultAdmin = false;

// High-Performance In-Memory Cache for validated admin sessions (60s TTL)
// Eliminates 95% of D1 database roundtrips on concurrent browser requests
interface CachedAdminSession {
  admin: Admin;
  expiresAt: number;
}
const inMemoryAdminCache = new Map<string, CachedAdminSession>();

export function invalidateAdminCache(email?: string) {
  if (email) {
    inMemoryAdminCache.delete(email);
  } else {
    inMemoryAdminCache.clear();
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { admin: Admin } }>, next: Next) {
  const adminRepo = new AdminRepository(c.env.DB);
  const memberRepo = new MemberRepository(c.env.DB);

  const validateAndSetAdmin = async (admin: Admin | null): Promise<boolean> => {
    if (!admin || admin.status !== 'active') return false;

    if (admin.member_id) {
      const member = await memberRepo.findById(admin.member_id);
      if (!member || member.status !== 'active') {
        await adminRepo.deactivateByMemberId(admin.member_id);
        return false;
      }
    }

    c.set('admin', admin);
    return true;
  };

  // 1. Check Cloudflare Access Header
  const cfEmail = c.req.header('cf-access-authenticated-user-email');
  if (cfEmail) {
    const now = Date.now();
    const cached = inMemoryAdminCache.get(cfEmail);
    if (cached && cached.expiresAt > now && cached.admin.status === 'active') {
      c.set('admin', cached.admin);
      return next();
    }

    const admin = await adminRepo.findByEmail(cfEmail);
    if (await validateAndSetAdmin(admin)) {
      if (admin) {
        inMemoryAdminCache.set(cfEmail, { admin, expiresAt: now + 60_000 });
      }
      return next();
    }
  }

  // 2. Check Session Cookie or Authorization Header
  const sessionToken =
    getCookie(c, 'absen_session') ||
    c.req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (sessionToken) {
    let adminEmail: string | null = null;

    // A. Verify Stateless Cryptographic Token (0 KV writes/reads, ultra-fast <0.2ms)
    const secret = c.env.SESSION_SECRET || 'ams-default-session-secret-key-32-chars-minimum';
    const verifiedPayload = await verifySessionToken(sessionToken, secret);
    if (verifiedPayload) {
      adminEmail = verifiedPayload.email;
    }

    // B. Fallback to memory session store / KV for legacy tokens
    if (!adminEmail) {
      adminEmail = memorySessionStore.get(sessionToken) || null;
    }

    if (!adminEmail && c.env.KV) {
      try {
        adminEmail = await c.env.KV.get(`session:${sessionToken}`);
      } catch {
        // ignore KV errors
      }
    }

    if (adminEmail) {
      const now = Date.now();
      const cached = inMemoryAdminCache.get(adminEmail);
      if (cached && cached.expiresAt > now && cached.admin.status === 'active') {
        c.set('admin', cached.admin);
        return next();
      }

      const admin = await adminRepo.findByEmail(adminEmail);
      if (await validateAndSetAdmin(admin)) {
        if (admin) {
          inMemoryAdminCache.set(adminEmail, { admin, expiresAt: now + 60_000 });
        }
        return next();
      }
    }
  }

  // 3. First run initialization (cached flag ensures D1 count query only runs once)
  if (!hasCheckedDefaultAdmin) {
    const adminCount = await adminRepo.count();
    if (adminCount === 0) {
      await adminRepo.create({
        id: 'adm_owner_default',
        email: c.env.DEV_ADMIN_EMAIL || 'admin@absen.local',
        name: 'Default Owner',
        role: 'owner',
        status: 'active',
      });
    }
    hasCheckedDefaultAdmin = true;
  }

  // Strictly 401 Unauthorized if not authenticated!
  return c.json<ApiResponse>(
    {
      ok: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: 'Akses tidak diizinkan. Silakan login terlebih dahulu.',
      },
    },
    401
  );
}

export function requireRole(allowedRoles: Role[]) {
  return async (c: Context<{ Variables: { admin: Admin } }>, next: Next) => {
    const admin = c.get('admin');
    if (!admin || !allowedRoles.includes(admin.role)) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'Anda tidak memiliki hak akses untuk tindakan ini.',
          },
        },
        403
      );
    }
    await next();
  };
}
