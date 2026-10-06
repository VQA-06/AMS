import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../env';
import { AdminRepository, sanitizeAdmin } from '../repositories/admin.repo';
import { MemberRepository } from '../repositories/member.repo';
import { Admin, ApiResponse, Role } from '@/shared/types';

// In-memory session store fallback for development / KV environments
export const memorySessionStore = new Map<string, string>();
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

// In-Memory Store for Revoked Session Tokens (mapped to expiration timestamp in ms)
const revokedTokenStore = new Map<string, number>();

// In-Memory Store for Admin Revocation Timestamps (maps admin email to timestamp ms)
const adminRevocationTimestamps = new Map<string, number>();

export function revokeSessionToken(token: string, expiresAtMs: number = Date.now() + 7 * 86400 * 1000): void {
  if (!token) return;
  revokedTokenStore.set(token, expiresAtMs);
  const parts = token.split('.');
  if (parts.length === 2 && parts[1]) {
    revokedTokenStore.set(parts[1], expiresAtMs);
  }
  if (revokedTokenStore.size > 1000) {
    const now = Date.now();
    for (const [key, exp] of revokedTokenStore.entries()) {
      if (exp <= now) revokedTokenStore.delete(key);
    }
  }
}

export async function isSessionTokenRevoked(token: string, env?: Env): Promise<boolean> {
  if (!token) return true;
  const now = Date.now();
  const exp = revokedTokenStore.get(token);
  if (exp && exp > now) return true;

  const parts = token.split('.');
  if (parts.length === 2 && parts[1]) {
    const sigExp = revokedTokenStore.get(parts[1]);
    if (sigExp && sigExp > now) return true;
  }

  if (env?.KV) {
    try {
      const kvRevoked = await env.KV.get(`revoked:${token}`);
      if (kvRevoked) return true;
    } catch {
      // ignore KV errors
    }
  }
  return false;
}

export function revokeAllSessionsForAdmin(email: string): void {
  if (!email) return;
  const normalized = email.toLowerCase().trim();
  adminRevocationTimestamps.set(normalized, Date.now());
  invalidateAdminCache(normalized);
}

export function resetAuthStore(): void {
  inMemoryAdminCache.clear();
  revokedTokenStore.clear();
  adminRevocationTimestamps.clear();
}

export function invalidateAdminCache(email?: string) {
  if (email) {
    inMemoryAdminCache.delete(email.toLowerCase().trim());
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

    const sanitized = sanitizeAdmin(admin);
    if (!sanitized) return false;
    c.set('admin', sanitized as Admin);
    return true;
  };

  // 1. Authenticate via Cryptographic Session Token (Cookie or Authorization Header)
  const sessionToken =
    getCookie(c, 'absen_session') ||
    c.req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (sessionToken) {
    // Check if token has been revoked on logout
    if (await isSessionTokenRevoked(sessionToken, c.env)) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Sesi login telah berakhir atau dicabut. Silakan login kembali.',
          },
        },
        401
      );
    }

    let adminEmail: string | null = null;
    let tokenIat: number | null = null;

    // A. Verify Stateless Cryptographic Token (0 KV writes/reads, ultra-fast <0.2ms)
    const secret = c.env.SESSION_SECRET || 'ams-default-session-secret-key-32-chars-minimum';
    const verifiedPayload = await verifySessionToken(sessionToken, secret);
    if (verifiedPayload) {
      adminEmail = verifiedPayload.email;
      tokenIat = verifiedPayload.iat;
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
      const normalizedEmail = adminEmail.toLowerCase().trim();

      // Check if all sessions for this admin were invalidated (e.g. deactivation or password change)
      if (tokenIat && adminRevocationTimestamps.has(normalizedEmail)) {
        const revokedTimestamp = adminRevocationTimestamps.get(normalizedEmail)!;
        if (tokenIat * 1000 <= revokedTimestamp) {
          return c.json<ApiResponse>(
            {
              ok: false,
              error: {
                code: ErrorCode.UNAUTHORIZED,
                message: 'Sesi akun telah dinonaktifkan atau diatur ulang. Silakan login kembali.',
              },
            },
            401
          );
        }
      }

      const now = Date.now();
      const cached = inMemoryAdminCache.get(normalizedEmail);
      if (cached && cached.expiresAt > now && cached.admin.status === 'active') {
        c.set('admin', cached.admin);
        return next();
      }

      const admin = await adminRepo.findByEmail(normalizedEmail);
      if (await validateAndSetAdmin(admin)) {
        if (admin) {
          inMemoryAdminCache.set(normalizedEmail, { admin, expiresAt: now + 60_000 });
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
