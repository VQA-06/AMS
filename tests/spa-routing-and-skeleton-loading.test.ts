import { describe, it, expect } from 'vitest';
import app from '../src/server/index';
import { parseRoute } from '../src/client/App';
import { invalidateEdgeCache, putEdgeCache, matchEdgeCache } from '../src/server/lib/edge-cache';

describe('SPA Routing Preservation on Refresh & Edge Invalidation Resilience', () => {
  describe('Server SPA HTML5 History Routing', () => {
    it('should return 404 JSON for non-existent API routes instead of falling back to HTML', async () => {
      const mockEnv = {
        ASSETS: {
          fetch: async () => new Response('Asset not found', { status: 404 }),
        },
      };
      const res = await app.request('/api/non-existent-endpoint', { method: 'GET' }, mockEnv as any);
      expect(res.status).toBe(404);
      const json = await res.json() as any;
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('should serve index.html when ASSETS returns 404 or redirect on client-side routes', async () => {
      let requestedUrl = '';
      const mockEnv = {
        ASSETS: {
          fetch: async (request: Request) => {
            requestedUrl = request.url;
            if (request.url.endsWith('/events')) {
              return new Response(null, { status: 302, headers: { Location: '/' } });
            }
            if (request.url.endsWith('/index.html')) {
              return new Response('<!DOCTYPE html><html><body><div id="root">AMS SPA</div></body></html>', {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
              });
            }
            return new Response('File content', { status: 200 });
          },
        },
      };

      const res = await app.request('/events', { method: 'GET' }, mockEnv as any);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<div id="root">AMS SPA</div>');
      expect(requestedUrl).toContain('/index.html');
    });
  });

  describe('Client-Side parseRoute Preservation', () => {
    it('should correctly parse /events subroute', () => {
      const parsed = parseRoute('/events');
      expect(parsed.tab).toBe('events');
      expect(parsed.eventId).toBeNull();
      expect(parsed.isLogin).toBe(false);
    });

    it('should correctly parse /events/:id detail subroute', () => {
      const parsed = parseRoute('/events/evt_community_gathering_123');
      expect(parsed.tab).toBe('events');
      expect(parsed.eventId).toBe('evt_community_gathering_123');
      expect(parsed.isLogin).toBe(false);
    });

    it('should correctly parse /members subroute', () => {
      const parsed = parseRoute('/members');
      expect(parsed.tab).toBe('members');
    });

    it('should correctly parse /scanner subroute', () => {
      const parsed = parseRoute('/scanner');
      expect(parsed.tab).toBe('scanner');
    });

    it('should correctly parse /tracker subroute', () => {
      const parsed = parseRoute('/tracker');
      expect(parsed.tab).toBe('tracker');
    });

    it('should correctly parse /settings subroute', () => {
      const parsed = parseRoute('/settings');
      expect(parsed.tab).toBe('settings');
    });

    it('should correctly parse /login route', () => {
      const parsed = parseRoute('/login');
      expect(parsed.isLogin).toBe(true);
    });
  });

  describe('Edge Cache Invalidation with Relative Path Strings (No Invalid URL Exceptions)', () => {
    it('should safely invalidate relative path targets without throwing TypeError: Invalid URL', async () => {
      const relativePath1 = '/api/agenda/reports/top-presence';
      const relativePath2 = '/api/agenda';
      const fullUrl = 'https://ams.humanone.workers.dev/api/agenda/reports/top-presence';

      const mockResponse = new Response(JSON.stringify({ ok: true, events: [{ id: '1', name: 'Workshop' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      // 1. Put into cache
      await putEdgeCache(fullUrl, mockResponse, 60, 'agenda');

      // Verify cached
      const cached = await matchEdgeCache(fullUrl);
      expect(cached).not.toBeNull();

      // 2. Invalidate using exact relative path strings from wrangler tail error log
      await expect(invalidateEdgeCache([relativePath1, relativePath2])).resolves.not.toThrow();

      // 3. Verify properly purged
      const afterPurge = await matchEdgeCache(fullUrl);
      expect(afterPurge).toBeNull();
    });

    it('should safely reconstruct fresh Response objects across multiple calls without cross-request I/O errors', async () => {
      const testUrl = 'https://ams.humanone.workers.dev/api/members/divisions';
      const mockResponse = new Response(JSON.stringify({ ok: true, divisions: ['Design', 'Core'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      await putEdgeCache(testUrl, mockResponse, 60, 'members');

      // Request 1: reads and consumes response
      const res1 = await matchEdgeCache(testUrl);
      expect(res1).not.toBeNull();
      const text1 = await res1!.text();
      expect(text1).toContain('Design');

      // Request 2: reads independently (must not throw stream consumed or cross-request error)
      const res2 = await matchEdgeCache(testUrl);
      expect(res2).not.toBeNull();
      const json2 = await res2!.json() as any;
      expect(json2.divisions).toEqual(['Design', 'Core']);
    });
  });
});
