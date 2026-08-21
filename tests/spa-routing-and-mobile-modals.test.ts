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
});
