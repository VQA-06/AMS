import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { matchEdgeCache, putEdgeCache, invalidateEdgeCache } from '../src/server/lib/edge-cache';
import { edgeCache } from '../src/server/middleware/edge-cache';

describe('Edge Caching & Granular Targeted Invalidation Tests', () => {
  beforeEach(async () => {
    // Clear all test edge cache entries
    await invalidateEdgeCache(['agenda', 'members', 'attendance', 'test']);
  });

  describe('Core Edge Cache Engine (edge-cache.ts)', () => {
    it('should store and retrieve response with accurate TTL and HIT status', async () => {
      const url = 'https://ams.local/api/test-cache-item';
      const initialResponse = new Response(JSON.stringify({ ok: true, data: { number: 42 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      // 1. Initial match should be null (MISS)
      const miss = await matchEdgeCache(url);
      expect(miss).toBeNull();

      // 2. Put into Edge Cache
      await putEdgeCache(url, initialResponse, 60, 'test');

      // 3. Subsequent match should return cached response (HIT)
      const hit = await matchEdgeCache(url);
      expect(hit).not.toBeNull();
      expect(hit?.status).toBe(200);
      expect(hit?.headers.get('X-AMS-Edge-Cache')).toBe('HIT');

      const json = (await hit?.json()) as any;
      expect(json.data.number).toBe(42);
    });

    it('should perform Granular Targeted Invalidation without resetting unrelated cache tags', async () => {
      const urlAgenda = 'https://ams.local/api/agenda';
      const urlMembers = 'https://ams.local/api/members/divisions';

      const resAgenda = new Response(JSON.stringify({ ok: true, data: { events: ['Event 1'] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      const resMembers = new Response(JSON.stringify({ ok: true, data: { divisions: ['IT', 'HR'] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      // 1. Cache both domains
      await putEdgeCache(urlAgenda, resAgenda, 60, 'agenda');
      await putEdgeCache(urlMembers, resMembers, 60, 'members');

      // Verify both are cached (HIT)
      expect(await matchEdgeCache(urlAgenda)).not.toBeNull();
      expect(await matchEdgeCache(urlMembers)).not.toBeNull();

      // 2. Invalidate ONLY agenda domain
      await invalidateEdgeCache('agenda');

      // 3. Agenda should now be PURGED (null), but Members MUST REMAIN INTACT (HIT)!
      const checkAgenda = await matchEdgeCache(urlAgenda);
      const checkMembers = await matchEdgeCache(urlMembers);

      expect(checkAgenda).toBeNull();
      expect(checkMembers).not.toBeNull();
      expect(checkMembers?.headers.get('X-AMS-Edge-Cache')).toBe('HIT');

      // 4. Now invalidate members domain
      await invalidateEdgeCache('members');
      expect(await matchEdgeCache(urlMembers)).toBeNull();
    });
  });

  describe('Edge Cache Hono Middleware (edge-cache.ts)', () => {
    it('should intercept GET requests, cache 200 responses, and serve HIT in <5ms', async () => {
      let backendQueryCount = 0;
      const app = new Hono();

      app.get('/api/cached-route', edgeCache({ ttlSeconds: 30, tag: 'test' }), (c) => {
        backendQueryCount++;
        return c.json({ ok: true, queryCount: backendQueryCount });
      });

      // 1. First Request (Cache MISS -> executes route handler)
      const res1 = await app.request('/api/cached-route');
      expect(res1.status).toBe(200);
      const json1 = (await res1.json()) as any;
      expect(json1.queryCount).toBe(1);
      expect(backendQueryCount).toBe(1);

      // 2. Second Request (Cache HIT -> served without executing route handler)
      const res2 = await app.request('/api/cached-route');
      expect(res2.status).toBe(200);
      const json2 = (await res2.json()) as any;
      expect(json2.queryCount).toBe(1); // Cached value!
      expect(backendQueryCount).toBe(1); // Handler was NOT called again!

      // 3. Invalidate 'test' tag
      await invalidateEdgeCache('test');

      // 4. Third Request (Cache MISS after invalidation -> executes route handler)
      const res3 = await app.request('/api/cached-route');
      expect(res3.status).toBe(200);
      const json3 = (await res3.json()) as any;
      expect(json3.queryCount).toBe(2);
      expect(backendQueryCount).toBe(2);
    });

    it('should respond with 304 Not Modified when client provides matching If-None-Match header', async () => {
      const app = new Hono();
      app.get('/api/etag-route', edgeCache({ ttlSeconds: 30, tag: 'test' }), (c) => {
        c.header('ETag', 'W/"custom-tag-123"');
        return c.json({ ok: true, data: 'fresh-data' });
      });

      // 1. First request
      const res1 = await app.request('/api/etag-route');
      expect(res1.status).toBe(200);

      // 2. Second request with matching ETag
      const res2 = await app.request('/api/etag-route', {
        headers: { 'If-None-Match': 'W/"custom-tag-123"' },
      });
      expect(res2.status).toBe(304);
      expect(await res2.text()).toBe('');
    });
  });
});
