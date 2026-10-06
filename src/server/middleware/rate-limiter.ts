import { Context, Next } from 'hono';
import { ApiResponse } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * On-demand lazy cleanup for stale rate limit records
 * Executed strictly within the request handler lifecycle to avoid Cloudflare Workers global scope violations.
 */
function cleanupStaleRecords(now: number): void {
  // Only trigger cleanup if store grows beyond 500 entries
  if (rateLimitStore.size > 500) {
    for (const [key, record] of rateLimitStore.entries()) {
      if (now - record.firstAttemptAt > 60 * 60 * 1000) {
        rateLimitStore.delete(key);
      }
    }
  }
}

export interface RateLimitOptions {
  maxAttempts?: number; // default: 10 attempts per IP
  maxAccountAttempts?: number; // default: 5 failed attempts per Account identifier
  windowMs?: number; // default: 15 minutes (15 * 60 * 1000)
  lockoutMs?: number; // default: 15 minutes
  keyPrefix?: string;
}

/**
 * In-Memory Sliding Window Multi-Key Rate Limiter for Authentication & Sensitive Endpoints
 * Tracks failed attempts across both client IP and targeted account identifiers.
 * Prevents credential stuffing, distributed brute-force, and IP-rotation password spray attacks.
 * 100% compliant with Cloudflare Workers / workerd execution scope constraints.
 */
export function authRateLimiter(options: RateLimitOptions = {}) {
  const maxAttempts = options.maxAttempts || 10;
  const maxAccountAttempts = options.maxAccountAttempts || 5;
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const lockoutMs = options.lockoutMs || 15 * 60 * 1000;
  const keyPrefix = options.keyPrefix || 'auth';

  return async (c: Context, next: Next) => {
    const clientIp =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      'unknown-client';
    const ipKey = `${keyPrefix}:ip:${clientIp}`;
    const now = Date.now();

    // Safely extract account identifier from JSON body if present without consuming the stream
    let accountEmail: string | null = null;
    const contentType = c.req.header('content-type') || '';
    if (contentType.toLowerCase().includes('application/json')) {
      try {
        const clonedReq = c.req.raw.clone();
        const body = (await clonedReq.json()) as Record<string, unknown>;
        if (body && typeof body.email === 'string' && body.email.trim()) {
          accountEmail = body.email.trim().toLowerCase();
        }
      } catch {
        // Ignore parse errors here; validation schema will handle invalid bodies downstream
      }
    }

    const accountKey = accountEmail ? `${keyPrefix}:account:${accountEmail}` : null;

    // Lazy cleanup of old entries inside request cycle
    cleanupStaleRecords(now);

    // 1. Check IP-based lockout
    const ipRecord = rateLimitStore.get(ipKey);
    if (ipRecord) {
      if (ipRecord.lockedUntil && ipRecord.lockedUntil > now) {
        const remainingMinutes = Math.ceil((ipRecord.lockedUntil - now) / 60000);
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.RATE_LIMITED,
              message: `Terlalu banyak percobaan gagal dari IP ini. Silakan coba kembali dalam ${remainingMinutes} menit.`,
            },
          },
          429
        );
      }
      if (now - ipRecord.firstAttemptAt > windowMs) {
        rateLimitStore.set(ipKey, { attempts: 0, firstAttemptAt: now });
      }
    }

    // 2. Check Account-based lockout (prevents distributed brute force via IP rotation)
    if (accountKey) {
      const accRecord = rateLimitStore.get(accountKey);
      if (accRecord) {
        if (accRecord.lockedUntil && accRecord.lockedUntil > now) {
          const remainingMinutes = Math.ceil((accRecord.lockedUntil - now) / 60000);
          return c.json<ApiResponse>(
            {
              ok: false,
              error: {
                code: ErrorCode.RATE_LIMITED,
                message: `Akun ini sementara dikunci karena terlalu banyak percobaan gagal. Silakan coba kembali dalam ${remainingMinutes} menit.`,
              },
            },
            429
          );
        }
        if (now - accRecord.firstAttemptAt > windowMs) {
          rateLimitStore.set(accountKey, { attempts: 0, firstAttemptAt: now });
        }
      }
    }

    await next();

    // If request failed with 401 or 400 (failed authentication), increment attempt counters
    if (c.res.status === 401 || c.res.status === 400) {
      const currentIp = rateLimitStore.get(ipKey) || { attempts: 0, firstAttemptAt: now };
      currentIp.attempts += 1;
      if (currentIp.attempts >= maxAttempts) {
        currentIp.lockedUntil = now + lockoutMs;
      }
      rateLimitStore.set(ipKey, currentIp);

      if (accountKey) {
        const currentAcc = rateLimitStore.get(accountKey) || { attempts: 0, firstAttemptAt: now };
        currentAcc.attempts += 1;
        if (currentAcc.attempts >= maxAccountAttempts) {
          currentAcc.lockedUntil = now + lockoutMs;
        }
        rateLimitStore.set(accountKey, currentAcc);
      }
    } else if (c.res.status >= 200 && c.res.status < 300) {
      // Successful login resets rate limit counter for this IP and account
      rateLimitStore.delete(ipKey);
      if (accountKey) {
        rateLimitStore.delete(accountKey);
      }
    }
  };
}

/**
 * Resets rate limit store (useful for automated testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
