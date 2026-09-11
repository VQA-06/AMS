import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { matchEdgeCache, putEdgeCache } from '../lib/edge-cache';

export interface EdgeCacheOptions {
  ttlSeconds: number;
  tag: string;
}

/**
 * Enterprise Cloudflare Edge Cache Middleware
 * - Intercepts GET requests
 * - Serves matching cached response instantly in <5ms with X-AMS-Edge-Cache: HIT
 * - If MISS, executes the route handler and caches the 200 response with tag metadata
 */
export function edgeCache(options: EdgeCacheOptions) {
  const { ttlSeconds, tag } = options;

  return createMiddleware(async (c: Context, next: Next) => {
    // Only cache GET requests
    if (c.req.method !== 'GET') {
      return next();
    }

    const url = c.req.url;

    // 1. Try to match from Edge Cache
    const cachedResponse = await matchEdgeCache(url);
    if (cachedResponse) {
      // Check for ETag 304 match if client provided If-None-Match
      const ifNoneMatch = c.req.header('if-none-match');
      const cachedEtag = cachedResponse.headers.get('etag') || cachedResponse.headers.get('ETag');

      if (ifNoneMatch && cachedEtag && (ifNoneMatch === cachedEtag || ifNoneMatch.includes(cachedEtag))) {
        return new Response(null, {
          status: 304,
          statusText: 'Not Modified',
          headers: cachedResponse.headers,
        });
      }

      const res = new Response(cachedResponse.body, cachedResponse);
      res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
      res.headers.set('Pragma', 'no-cache');
      res.headers.set('Expires', '0');
      res.headers.set('X-AMS-Edge-Cache', 'HIT');
      return res;
    }

    // 2. Cache MISS - Proceed to handler
    await next();

    // 3. Store into Edge Cache if 200 OK
    if (c.res && c.res.status === 200) {
      try {
        c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        c.res.headers.set('Pragma', 'no-cache');
        c.res.headers.set('Expires', '0');
      } catch {
        c.res = new Response(c.res.body, c.res);
        c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        c.res.headers.set('Pragma', 'no-cache');
        c.res.headers.set('Expires', '0');
      }
      try {
        const responseToCache = c.res.clone();
        await putEdgeCache(url, responseToCache, ttlSeconds, tag, c);
      } catch {
        // Safe fallback
      }
    }
  });
}
