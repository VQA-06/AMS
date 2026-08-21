import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeCsvCell, sanitizeCsvRow } from '../src/server/lib/csv-sanitizer';
import { timingSafeEqualStrings } from '../src/server/crypto/timing-safe';
import { authRateLimiter, resetRateLimitStore } from '../src/server/middleware/rate-limiter';
import { Hono } from 'hono';
import { securityHeaders } from '../src/server/middleware/security-headers';

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
      const s1 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const s2 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(timingSafeEqualStrings(s1, s2)).toBe(true);
    });

    it('should return false for different strings of same length', () => {
      const s1 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const s2 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856';
      expect(timingSafeEqualStrings(s1, s2)).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      const s1 = 'short';
      const s2 = 'longer_string';
      expect(timingSafeEqualStrings(s1, s2)).toBe(false);
    });
  });

  describe('Anti-Brute-Force Rate Limiting (authRateLimiter)', () => {
    beforeEach(() => {
      resetRateLimitStore();
    });

    it('should lock out after exceeding maximum failed login attempts', async () => {
      const app = new Hono();
      app.post(
        '/login-test',
        authRateLimiter({ maxAttempts: 3, windowMs: 60000, lockoutMs: 60000 }),
        async (c) => {
          const body = await c.req.json().catch(() => ({}));
          if (body.pass !== 'correct') {
            return c.json({ ok: false, error: 'Invalid' }, 401);
          }
          return c.json({ ok: true });
        }
      );

      const clientHeaders = { 'cf-connecting-ip': '192.168.1.100', 'Content-Type': 'application/json' };

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/login-test', {
          method: 'POST',
          headers: clientHeaders,
          body: JSON.stringify({ pass: 'wrong' }),
        });
        expect(res.status).toBe(401);
      }

      // 4th attempt should be blocked with 429 Too Many Requests
      const blockedRes = await app.request('/login-test', {
        method: 'POST',
        headers: clientHeaders,
        body: JSON.stringify({ pass: 'wrong' }),
      });
      expect(blockedRes.status).toBe(429);
      const json = (await blockedRes.json()) as any;
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('Enterprise Security Headers Middleware', () => {
    it('should include nosniff, DENY, and strict-origin headers on responses', async () => {
      const app = new Hono();
      app.use('*', securityHeaders());
      app.get('/test', (c) => c.text('OK'));

      const res = await app.request('/test');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('Permissions-Policy')).toContain('camera=(self)');
    });
  });
});
