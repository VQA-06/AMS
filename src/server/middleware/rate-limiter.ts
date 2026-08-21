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
  maxAttempts?: number; // default: 10
  windowMs?: number; // default: 15 minutes (15 * 60 * 1000)
  lockoutMs?: number; // default: 15 minutes
  keyPrefix?: string;
}

/**
 * In-Memory Sliding Window Rate Limiter for Authentication & Sensitive Endpoints
 * Mitigates credential stuffing, password guessing, and automated brute-force attacks.
 * 100% compliant with Cloudflare Workers / workerd execution scope constraints.
 */
export function authRateLimiter(options: RateLimitOptions = {}) {
  const maxAttempts = options.maxAttempts || 10;
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const lockoutMs = options.lockoutMs || 15 * 60 * 1000;
  const keyPrefix = options.keyPrefix || 'auth';

  return async (c: Context, next: Next) => {
    const clientIp =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      'unknown-client';
    const key = `${keyPrefix}:${clientIp}`;
    const now = Date.now();

    // Lazy cleanup of old entries inside request cycle
    cleanupStaleRecords(now);

    const record = rateLimitStore.get(key);

    if (record) {
      // Check if currently locked out
      if (record.lockedUntil && record.lockedUntil > now) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.RATE_LIMITED,
              message: `Terlalu banyak percobaan gagal. Silakan coba kembali dalam ${remainingMinutes} menit.`,
            },
          },
          429
        );
      }

      // If window has passed, reset record
      if (now - record.firstAttemptAt > windowMs) {
        rateLimitStore.set(key, { attempts: 1, firstAttemptAt: now });
      }
    }

    await next();

    // If request failed with 401 or 400 (failed authentication), increment attempt count
    if (c.res.status === 401 || c.res.status === 400) {
      const current = rateLimitStore.get(key) || { attempts: 0, firstAttemptAt: now };
      current.attempts += 1;

      if (current.attempts >= maxAttempts) {
        current.lockedUntil = now + lockoutMs;
      }
      rateLimitStore.set(key, current);
    } else if (c.res.status >= 200 && c.res.status < 300) {
      // Successful login resets rate limit counter for this IP
      rateLimitStore.delete(key);
    }
  };
}

/**
 * Resets rate limit store (useful for automated testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
