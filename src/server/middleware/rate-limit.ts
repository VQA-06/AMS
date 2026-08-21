import { Context, Next } from 'hono';
import { Env } from '../env';
import { ErrorCode } from '@/shared/constants/error-codes';
import { ApiResponse } from '@/shared/types';

export function createRateLimiter(options: { maxRequests: number; windowSeconds: number; keyPrefix: string }) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const kv = c.env.KV;
    if (!kv) {
      return next();
    }

    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const nowWindow = Math.floor(Date.now() / 1000 / options.windowSeconds);
    const key = `ratelimit:${options.keyPrefix}:${ip}:${nowWindow}`;

    try {
      const current = await kv.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= options.maxRequests) {
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.RATE_LIMITED,
              message: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
            },
          },
          429
        );
      }

      await kv.put(key, (count + 1).toString(), {
        expirationTtl: options.windowSeconds * 2,
      });
    } catch {
      // Don't block requests if KV fails in dev
    }

    await next();
  };
}
