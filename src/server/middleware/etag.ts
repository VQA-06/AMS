import { Context, Next } from 'hono';

/**
 * Fast FNV-1a 32-bit Hash for generating lightweight Weak ETags
 */
function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Enterprise ETag & HTTP 304 Not Modified Middleware
 * - Intercepts GET JSON responses
 * - Attaches Weak ETag: W/"<hash>-<len>"
 * - Returns 304 Not Modified with 0 byte body if Client already has fresh data
 * - Reduces network bandwidth and client rendering latency to <1ms
 */
export function etagMiddleware() {
  return async (c: Context, next: Next) => {
    await next();

    // Only apply to successful GET responses
    if (c.req.method !== 'GET' || c.res.status !== 200) {
      return;
    }

    const contentType = c.res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return;
    }

    try {
      // Clone response to read body without consuming stream
      const clone = c.res.clone();
      const bodyText = await clone.text();
      if (!bodyText || bodyText.length === 0) return;

      const tag = `W/"${fnv1a(bodyText)}-${bodyText.length.toString(36)}"`;
      c.header('ETag', tag);

      const ifNoneMatch = c.req.header('if-none-match');
      if (ifNoneMatch && (ifNoneMatch === tag || ifNoneMatch.includes(tag))) {
        // Return 304 Not Modified with empty body
        c.res = new Response(null, {
          status: 304,
          statusText: 'Not Modified',
          headers: c.res.headers,
        });
      }
    } catch {
      // Fallback cleanly if stream cloning is unsupported
    }
  };
}
