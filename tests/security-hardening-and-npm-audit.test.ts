import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Admin } from '../src/shared/types';
import type { Env } from '../src/server/env';
import { sanitizeCsvCell, sanitizeCsvRow } from '../src/server/lib/csv-sanitizer';
import { escapeHtml } from '../src/client/lib/html-utils';
import { timingSafeEqualStrings } from '../src/server/crypto/timing-safe';
import { authRateLimiter, resetRateLimitStore } from '../src/server/middleware/rate-limiter';
import { securityHeaders } from '../src/server/middleware/security-headers';
import { sanitizeAdmin } from '../src/server/repositories/admin.repo';
import { escapeLikePattern } from '../src/server/lib/sql-utils';
import app, { isAllowedOrigin } from '../src/server/index';
import { errorHandler } from '../src/server/middleware/error-handler';
import { authMiddleware } from '../src/server/middleware/auth';

interface ApiErrorResponse {
  ok: boolean;
  error: {
    code?: string;
    message: string;
  };
}

describe('Security Hardening & Vulnerability Mitigation Tests', () => {
  describe('CSV Formula Injection Defense (CWE-1236)', () => {
    it('should escape dangerous formula trigger characters (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe('\'=cmd|"/C calc"!A0');
      expect(sanitizeCsvCell('+123456789')).toBe('\'+123456789');
      expect(sanitizeCsvCell('-SUM(A1:A10)')).toBe('\'-SUM(A1:A10)');
      expect(sanitizeCsvCell('@HYPERLINK("http://evil.com","Click")')).toBe('\'@HYPERLINK("http://evil.com","Click")');
      expect(sanitizeCsvCell('\tTabLeading')).toBe('\'\tTabLeading');
    });

    it('should keep safe normal strings unchanged', () => {
      expect(sanitizeCsvCell('Budi Santoso')).toBe('Budi Santoso');
      expect(sanitizeCsvCell('budi@example.com')).toBe('budi@example.com');
      expect(sanitizeCsvCell('MBR-123456')).toBe('MBR-123456');
      expect(sanitizeCsvCell(null)).toBe('');
      expect(sanitizeCsvCell(undefined)).toBe('');
    });

    it('should sanitize full row records properly', () => {
      const maliciousRow = {
        name: '=SUM(1+1)',
        external_id: 'MBR-999',
        email: '+attack@domain.com',
        phone: '08123456789',
      };

      const cleaned = sanitizeCsvRow(maliciousRow);
      expect(cleaned.name).toBe('\'=SUM(1+1)');
      expect(cleaned.external_id).toBe('MBR-999');
      expect(cleaned.email).toBe('\'+attack@domain.com');
      expect(cleaned.phone).toBe('08123456789');
    });
  });

  describe('Constant-Time String Comparison (Timing Side-Channel Defense)', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqualStrings('supersecrettoken123', 'supersecrettoken123')).toBe(true);
    });

    it('should return false for different strings of same length', () => {
      expect(timingSafeEqualStrings('supersecrettoken123', 'supersecrettoken124')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqualStrings('short', 'muchlongerstringhere')).toBe(false);
      expect(timingSafeEqualStrings('longerstring', 'short')).toBe(false);
    });
  });

  describe('Anti-Brute-Force Rate Limiting (authRateLimiter)', () => {
    beforeEach(() => {
      resetRateLimitStore();
    });

    it('should allow requests under the threshold', async () => {
      const testApp = new Hono();
      testApp.use('*', authRateLimiter({ maxAttempts: 3, lockoutMs: 60 * 1000 }));
      testApp.get('/test', (c) => c.text('invalid credentials', 401));

      const res1 = await testApp.request('/test', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
      expect(res1.status).toBe(401);

      const res2 = await testApp.request('/test', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
      expect(res2.status).toBe(401);
    });

    it('should block requests exceeding the threshold with 429 and Retry-After header', async () => {
      const testApp = new Hono();
      testApp.use('*', authRateLimiter({ maxAttempts: 2, lockoutMs: 60 * 1000 }));
      testApp.get('/test', (c) => c.text('invalid credentials', 401));

      // Req 1 & 2 fail authentication
      const r1 = await testApp.request('/test', { headers: { 'cf-connecting-ip': '5.6.7.8' } });
      expect(r1.status).toBe(401);
      const r2 = await testApp.request('/test', { headers: { 'cf-connecting-ip': '5.6.7.8' } });
      expect(r2.status).toBe(401);

      // Req 3 is blocked by rate limiter
      const blockedRes = await testApp.request('/test', { headers: { 'cf-connecting-ip': '5.6.7.8' } });
      expect(blockedRes.status).toBe(429);

      const json = (await blockedRes.json()) as ApiErrorResponse;
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('RATE_LIMITED');
      expect(json.error.message).toContain('Terlalu banyak percobaan gagal');
    });

    it('should track different IPs independently', async () => {
      const testApp = new Hono();
      testApp.use('*', authRateLimiter({ maxAttempts: 1, lockoutMs: 60 * 1000 }));
      testApp.get('/test', (c) => c.text('invalid credentials', 401));

      // IP A fails once
      const resA1 = await testApp.request('/test', { headers: { 'cf-connecting-ip': '10.0.0.1' } });
      expect(resA1.status).toBe(401);
      // IP A is now locked
      const resA2 = await testApp.request('/test', { headers: { 'cf-connecting-ip': '10.0.0.1' } });
      expect(resA2.status).toBe(429);

      // IP B is still fresh
      const resB1 = await testApp.request('/test', { headers: { 'cf-connecting-ip': '10.0.0.2' } });
      expect(resB1.status).toBe(401);
    });
  });

  describe('Enterprise Security Headers Middleware', () => {
    it('should inject essential security headers into responses', async () => {
      const testApp = new Hono();
      testApp.use('*', securityHeaders());
      testApp.get('/test', (c) => c.text('ok'));

      const res = await testApp.request('/test');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
      expect(res.headers.get('Permissions-Policy')).toContain('camera=(self)');
    });
  });

  describe('Sensitive Data Exposure Prevention (sanitizeAdmin)', () => {
    it('should completely strip password_hash from admin objects', () => {
      const rawAdmin: Admin = {
        id: 'adm_123',
        email: 'owner@cc.id',
        name: 'Super Owner',
        role: 'owner',
        status: 'active',
        password_hash: 'pbkdf2$100000$saltsalt$hashhashhash',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };

      const cleanAdmin = sanitizeAdmin(rawAdmin);
      expect(cleanAdmin).not.toBeNull();
      expect(cleanAdmin?.id).toBe('adm_123');
      expect(cleanAdmin?.email).toBe('owner@cc.id');
      expect('password_hash' in (cleanAdmin || {})).toBe(false);
      expect((cleanAdmin as Partial<Admin> | null)?.password_hash).toBeUndefined();
    });
  });

  describe('SQL LIKE Wildcard Sanitization (escapeLikePattern)', () => {
    it('should escape %, _, and \\ in user search queries', () => {
      expect(escapeLikePattern('100%')).toBe('100\\%');
      expect(escapeLikePattern('user_name')).toBe('user\\_name');
      expect(escapeLikePattern('path\\file')).toBe('path\\\\file');
      expect(escapeLikePattern('normal search')).toBe('normal search');
    });
  });

  describe('CORS Origin Whitelist Validation (isAllowedOrigin)', () => {
    it('should allow legitimate domains and reject untrusted attacker origins', () => {
      // Allowed
      expect(isAllowedOrigin(undefined)).toBe(true); // same-origin
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:8787')).toBe(true);
      expect(isAllowedOrigin('https://ams.ccunbaja.web.id')).toBe(true);
      expect(isAllowedOrigin('https://ams.humanone.workers.dev')).toBe(true);
      expect(isAllowedOrigin('https://custom-partner.org', { ALLOWED_ORIGINS: 'https://custom-partner.org' })).toBe(true);

      // Blocked untrusted cross-origins
      expect(isAllowedOrigin('https://evil-hacker.com')).toBe(false);
      expect(isAllowedOrigin('https://phishing-site.xyz')).toBe(false);
      expect(isAllowedOrigin('http://malicious.org')).toBe(false);
    });

    it('should not emit Access-Control-Allow-Credentials on untrusted origin preflight requests', async () => {
      // Untrusted origin
      const untrustedRes = await app.request('/api/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil-hacker.com',
          'Access-Control-Request-Method': 'GET',
        },
      });
      expect(untrustedRes.headers.get('access-control-allow-credentials')).toBeNull();
      expect(untrustedRes.headers.get('access-control-allow-origin')).toBeNull();

      // Trusted origin
      const trustedRes = await app.request('/api/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'GET',
        },
      });
      expect(trustedRes.headers.get('access-control-allow-credentials')).toBe('true');
      expect(trustedRes.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    });
  });

  describe('Internal Database Error Sanitization (errorHandler)', () => {
    it('should sanitize raw database query errors on 500 status in non-dev environment', async () => {
      const testApp = new Hono();
      testApp.onError(errorHandler);
      testApp.get('/trigger-500', () => {
        throw new Error('D1_ERROR: near "SELECT": syntax error in table members columns password_hash');
      });

      const res = await testApp.request(
        '/trigger-500',
        { method: 'GET' },
        { ENVIRONMENT: 'production' } as unknown as Env
      );
      expect(res.status).toBe(500);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.ok).toBe(false);
      // Raw SQLite schema and table names must NOT be leaked
      expect(json.error.message).not.toContain('D1_ERROR');
      expect(json.error.message).not.toContain('syntax error');
      expect(json.error.message).toContain('Terjadi gangguan pada server');
    });
  });

  describe('Header Spoofing Authentication Defense (authMiddleware)', () => {
    it('should reject unverified cf-access-authenticated-user-email header without valid token', async () => {
      const testApp = new Hono<{ Bindings: Env; Variables: { admin: Admin } }>();
      testApp.use('/protected', authMiddleware);
      testApp.get('/protected', (c) => c.json({ ok: true }));

      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ count: 1 }),
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
          first: async () => ({ count: 1 }),
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      } as unknown as D1Database;

      // Attacker tries to spoof Cloudflare Access header without valid HMAC session cookie
      const res = await testApp.request(
        '/protected',
        {
          method: 'GET',
          headers: { 'cf-access-authenticated-user-email': 'owner@cc.id' },
        },
        { DB: mockDb } as unknown as Env
      );

      expect(res.status).toBe(401);
      const json = (await res.json()) as ApiErrorResponse;
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('HTML Metacharacter Sanitization (CWE-79 Defense)', () => {
    it('should escape dangerous HTML characters to prevent DOM XSS', () => {
      expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(escapeHtml('<img src=x onerror="alert(document.cookie)">')).toBe('&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;');
      expect(escapeHtml('</title><script>alert(document.domain)</script>')).toBe('&lt;/title&gt;&lt;script&gt;alert(document.domain)&lt;/script&gt;');
      expect(escapeHtml("Budi & Santoso ' \" < >")).toBe('Budi &amp; Santoso &#39; &quot; &lt; &gt;');
    });

    it('should handle null, undefined, and non-string inputs safely', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(12345)).toBe('12345');
      expect(escapeHtml(true)).toBe('true');
    });
  });
});
