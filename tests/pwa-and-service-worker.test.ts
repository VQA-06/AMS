import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/server/index';

describe('Progressive Web App (PWA) & Service Worker Tests', () => {
  const publicDir = path.resolve(__dirname, '../public');

  describe('Web App Manifest Verification', () => {
    it('should have valid manifest.webmanifest with required PWA metadata', () => {
      const manifestPath = path.join(publicDir, 'manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(content.name).toBe('AMS | Computer Community');
      expect(content.short_name).toBe('AMS');
      expect(content.start_url).toBe('/');
      expect(content.display).toBe('standalone');
      expect(content.background_color).toBe('#020617');
      expect(content.theme_color).toBe('#020617');
      expect(Array.isArray(content.icons)).toBe(true);
      expect(content.icons.length).toBeGreaterThanOrEqual(4);
      expect(Array.isArray(content.shortcuts)).toBe(true);
      expect(content.shortcuts.length).toBe(4);
    });

    it('should have backward-compatible manifest.json matching webmanifest', () => {
      const jsonPath = path.join(publicDir, 'manifest.json');
      expect(fs.existsSync(jsonPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      expect(content.short_name).toBe('AMS');
      expect(content.display).toBe('standalone');
    });

    it('should verify all required PWA icons exist with valid file sizes', () => {
      const iconFiles = [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-192.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'icons/favicon-32.png',
        'icons/favicon-64.png',
        'logo.webp',
      ];

      for (const file of iconFiles) {
        const filePath = path.join(publicDir, file);
        expect(fs.existsSync(filePath), `Icon file ${file} should exist`).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(500);
      }
    });
  });

  describe('Service Worker File & Logic Verification', () => {
    it('should have sw.js with pre-caching, smart fetch routing, and update handling', () => {
      const swPath = path.join(publicDir, 'sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const content = fs.readFileSync(swPath, 'utf-8');
      expect(content).toContain('CACHE_NAME');
      expect(content).toContain('STATIC_ASSETS');
      expect(content).toContain('addEventListener(\'install\'');
      expect(content).toContain('addEventListener(\'activate\'');
      expect(content).toContain('addEventListener(\'fetch\'');
      expect(content).toContain('addEventListener(\'message\'');
      expect(content).toContain('self.skipWaiting()');
      expect(content).toContain('self.clients.claim()');
    });
  });

  describe('Server-Side PWA Header Delivery', () => {
    it('should serve /sw.js with anti-stale Cache-Control headers', async () => {
      const mockEnv = {
        ASSETS: {
          fetch: async (req: Request) => {
            return new Response('console.log("sw");', {
              status: 200,
              headers: { 'Content-Type': 'text/plain' },
            });
          },
        },
      };

      const res = await app.request('/sw.js', { method: 'GET' }, mockEnv as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
      expect(res.headers.get('Content-Type')).toBe('text/javascript');
    });

    it('should serve /manifest.webmanifest with application/manifest+json header', async () => {
      const mockEnv = {
        ASSETS: {
          fetch: async (req: Request) => {
            return new Response('{"name":"AMS"}', {
              status: 200,
              headers: { 'Content-Type': 'text/plain' },
            });
          },
        },
      };

      const res = await app.request('/manifest.webmanifest', { method: 'GET' }, mockEnv as any);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/manifest+json');
    });
  });
});
