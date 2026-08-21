import { describe, it, expect } from 'vitest';
import app from '../src/server/index';
import { eventSchema } from '../src/shared/schemas/event.schema';
import { ApiError } from '../src/client/lib/api-client';

describe('SPA Routing Fallback & Network Resilience Tests', () => {
  it('should fallback to /index.html when requesting client-side SPA routes via GET on static assets', async () => {
    let requestedUrl = '';
    const mockEnv = {
      ASSETS: {
        fetch: async (request: Request) => {
          requestedUrl = request.url;
          if (request.url.endsWith('/events')) {
            return new Response('Not Found', { status: 404 });
          }
          if (request.url.endsWith('/index.html')) {
            return new Response('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
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
    expect(html).toContain('<div id="root"></div>');
    expect(requestedUrl).toContain('/index.html');
  });

  it('should not fallback to /index.html for API routes returning 404', async () => {
    const mockEnv = {
      ASSETS: {
        fetch: async () => new Response('Asset not found', { status: 404 }),
      },
    };

    const res = await app.request('/api/unknown-endpoint', { method: 'GET' }, mockEnv as any);
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).not.toContain('<div id="root"></div>');
  });

  it('should correctly parse session_modes without double-stringifying', () => {
    const inputWithArray = {
      name: 'Seminar AI & Web3',
      session_modes: ['CHECKIN', 'CHECKOUT'],
    };
    const parsedArray = eventSchema.parse(inputWithArray);
    expect(parsedArray.session_modes).toBe('["CHECKIN","CHECKOUT"]');

    const inputWithString = {
      name: 'Workshop Cloudflare',
      session_modes: '["CHECKIN"]',
    };
    const parsedString = eventSchema.parse(inputWithString);
    expect(parsedString.session_modes).toBe('["CHECKIN"]');
  });

  it('should properly instantiate and structure ApiError instances', () => {
    const error = new ApiError('Gagal memproses data', 'VALIDATION_ERROR', { field: 'name' });
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Gagal memproses data');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'name' });
  });

  it('should handle backend error responses cleanly in fetchApi without throwing body already read TypeError', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Nama kegiatan wajib diisi.',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );

      const { fetchApi } = await import('../src/client/lib/api-client');
      await expect(fetchApi('/api/events', { method: 'POST' })).rejects.toThrow(
        'Nama kegiatan wajib diisi.'
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle non-JSON HTML 500 error responses cleanly in fetchApi', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async () =>
        new Response('<!DOCTYPE html><html><body>Internal Error</body></html>', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/html' },
        });

      const { fetchApi } = await import('../src/client/lib/api-client');
      await expect(fetchApi('/api/events', { method: 'POST' })).rejects.toThrow(
        /Terjadi gangguan pada server backend/
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should set compliant CORS headers matching the caller origin when credentials are used', async () => {
    const res = await app.request(
      '/api/health',
      {
        method: 'GET',
        headers: { Origin: 'https://ams.humanone.workers.dev' },
      },
      {} as any
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://ams.humanone.workers.dev'
    );
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should route /api/agenda and /api/programs and /api/activities seamlessly to event routes', async () => {
    const mockDbQuery = {
      bind: () => mockDbQuery,
      first: async () => ({ count: 1 }),
      all: async () => ({ results: [] }),
      run: async () => ({ success: true }),
    };
    const mockEnv = {
      DB: {
        prepare: () => mockDbQuery,
      },
    };

    // Test unauthenticated 401 response on all adblock-immune alias mounts
    const resAgenda = await app.request('/api/agenda', { method: 'GET' }, mockEnv as any);
    expect(resAgenda.status).toBe(401);

    const resPrograms = await app.request('/api/programs', { method: 'GET' }, mockEnv as any);
    expect(resPrograms.status).toBe(401);

    const resActivities = await app.request('/api/activities', { method: 'GET' }, mockEnv as any);
    expect(resActivities.status).toBe(401);

    // Verify /guests/batch and /guests/batch-names exist (not 404)
    const resBatch = await app.request('/api/agenda/evt_123/guests/batch', { method: 'POST' }, mockEnv as any);
    expect(resBatch.status).toBe(401); // 401 proves route exists and is caught by auth, not 404

    const resBatchNames = await app.request('/api/agenda/evt_123/guests/batch-names', { method: 'POST' }, mockEnv as any);
    expect(resBatchNames.status).toBe(401);
  });

  it('should deduplicate concurrent in-flight GET requests to the same URL in fetchApi', async () => {
    let callCount = 0;
    const originalFetch = global.fetch;
    try {
      global.fetch = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new Response(JSON.stringify({ ok: true, data: { status: 'healthy' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const { fetchApi } = await import('../src/client/lib/api-client');
      // Fire 3 simultaneous GET requests
      const [res1, res2, res3] = await Promise.all([
        fetchApi<{ status: string }>('/api/health'),
        fetchApi<{ status: string }>('/api/health'),
        fetchApi<{ status: string }>('/api/health'),
      ]);

      expect(res1.status).toBe('healthy');
      expect(res2.status).toBe('healthy');
      expect(res3.status).toBe('healthy');
      // Only 1 real network fetch occurred!
      expect(callCount).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
