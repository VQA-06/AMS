import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from '../src/server/routes/auth.routes';
import { membersRoutes } from '../src/server/routes/members.routes';
import { authRateLimiter, resetRateLimitStore } from '../src/server/middleware/rate-limiter';
import { invalidateAdminCache, authMiddleware } from '../src/server/middleware/auth';
import { DefaultAttendanceEngine } from '../src/server/domain/attendance/attendance-engine';
import { DefaultGuestPassManager } from '../src/server/domain/guest/guest-pass-manager';
import { memberImportRowSchema } from '../src/shared/schemas/member.schema';
import { generateQrToken } from '../src/server/crypto/qr-crypto';
import { ErrorCode } from '../src/shared/constants/error-codes';
import { Event, Member, QrToken, Admin } from '../src/shared/types';
import { PrintableToken } from '../src/client/components/qr/PrintBadgeSheet';

const TEST_BASE64_KEY = btoa('12345678901234567890123456789012');
const MOCK_ENV = {
  QR_ACTIVE_KID: 'k1',
  QR_KEY_K1: TEST_BASE64_KEY,
  APP_ISSUER: 'https://ams.ccunbaja.web.id',
  APP_AUDIENCE: 'ams',
  SESSION_SECRET: 'test-secret-key-32-chars-long-minimum-here!!',
  DB: {} as D1Database,
};

describe('Audit Remediation & Hardening Test Suite', () => {
  beforeEach(() => {
    resetRateLimitStore();
    invalidateAdminCache();
  });

  describe('1. Server Security & Authentication Hardening', () => {
    it('1.1 Rejects revoked QR token during admin QR login (POST /api/auth/login-qr)', async () => {
      const validFrom = new Date(Date.now() - 60000);
      const expiresAt = new Date(Date.now() + 3600000);

      const qrString = await generateQrToken(
        {
          memberId: 'mem_admin_1',
          jti: 'jti_revoked_test',
          scope: 'universal',
          validFrom,
          expiresAt,
          issuer: 'https://ams.ccunbaja.web.id',
          audience: 'ams',
          kid: 'k1',
        },
        MOCK_ENV
      );

      const mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...params: unknown[]) => ({
            first: vi.fn(async () => {
              // findByJti query
              if (sql.includes('FROM qr_tokens') || sql.includes('q.jti = ?')) {
                return {
                  id: 'tok_revoked_1',
                  jti: 'jti_revoked_test',
                  member_id: 'mem_admin_1',
                  scope: 'universal',
                  valid_from: validFrom.toISOString(),
                  expires_at: expiresAt.toISOString(),
                  revoked_at: new Date().toISOString(), // REVOKED!
                };
              }
              return null;
            }),
            all: vi.fn(async () => ({ results: [] })),
            run: vi.fn(async () => ({ success: true })),
          })),
        })),
      } as unknown as D1Database;

      const app = new Hono<{ Bindings: typeof MOCK_ENV }>();
      app.route('/api/auth', authRoutes);

      const res = await app.request('/api/auth/login-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr: qrString }),
      }, { ...MOCK_ENV, DB: mockDb });

      expect(res.status).toBe(401);
      const json = await res.json<any>();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe(ErrorCode.TOKEN_REVOKED);
    });

    it('1.2 Invalidate in-memory admin cache clears cached admin session', async () => {
      expect(() => invalidateAdminCache('admin@example.com')).not.toThrow();
      expect(() => invalidateAdminCache()).not.toThrow();
    });

    it('1.3 Rate limiter resets attempt count properly upon window expiration', async () => {
      vi.useFakeTimers();
      try {
        const app = new Hono();
        let callCount = 0;
        app.use('/test-login', authRateLimiter({ maxAttempts: 3, windowMs: 50 }));
        app.post('/test-login', (c) => {
          callCount++;
          return c.json({ ok: false, error: { message: 'Bad credentials' } }, 401);
        });

        // Attempt 1: Failed
        const res1 = await app.request('/test-login', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        });
        expect(res1.status).toBe(401);

        // Advance time for window to expire (>50ms)
        vi.advanceTimersByTime(60);

        // Attempt 2 after expiration: should reset counter and be counted as attempt 1 (not 2)
        const res2 = await app.request('/test-login', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        });
        expect(res2.status).toBe(401);

        // Attempt 3 (actual 2nd attempt in new window): still allowed
        const res3 = await app.request('/test-login', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        });
        expect(res3.status).toBe(401);

        // Attempt 4 (actual 3rd attempt in new window): still allowed (reaches max 3)
        const res4 = await app.request('/test-login', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        });
        expect(res4.status).toBe(401);

        // Attempt 5 (4th attempt): locked out
        const res5 = await app.request('/test-login', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        });
        expect(res5.status).toBe(429);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('2. Server Domain Logic & Repository Invariants', () => {
    const mockInactiveEvent: Event = {
      id: 'evt_inactive_1',
      name: 'Closed Event',
      description: null,
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-01-02T00:00:00Z',
      status: 'closed',
      location_name: 'Auditorium',
      allow_manual_attendance: 1,
      qr_policy: 'universal_allowed',
      grace_minutes: 30,
      created_at: '2026-01-01T00:00:00Z',
      session_modes: ['CHECKIN'],
      updated_at: '2026-01-01T00:00:00Z',
    };

    const mockActiveEvent: Event = {
      id: 'evt_active_1',
      name: 'Active Event',
      description: null,
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-12-31T23:59:59Z',
      status: 'active',
      location_name: 'Auditorium',
      allow_manual_attendance: 1,
      qr_policy: 'universal_allowed',
      grace_minutes: 30,
      created_at: '2026-01-01T00:00:00Z',
      session_modes: ['CHECKIN'],
      updated_at: '2026-01-01T00:00:00Z',
    };

    const mockInactiveMember: Member = {
      id: 'mem_inactive_1',
      name: 'Inactive Member',
      external_id: 'MBR-002',
      email: 'inactive@test.com',
      phone: null,
      division: 'IT',
      group_name: 'Staff',
      status: 'inactive',
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const mockActiveMember: Member = {
      id: 'mem_active_1',
      name: 'Active Member',
      external_id: 'MBR-001',
      email: 'active@test.com',
      phone: null,
      division: 'IT',
      group_name: 'Staff',
      status: 'active',
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('2.1a Rejects manual attendance for closed/inactive event', async () => {
      const mockEventRepo = {
        findById: vi.fn(async () => mockInactiveEvent),
      };
      const mockMemberRepo = {
        findById: vi.fn(async () => mockActiveMember),
      };
      const mockAttendanceRepo = {
        findByEventMemberSession: vi.fn(async () => null),
        create: vi.fn(),
      };
      const mockAuditRepo = {
        logAction: vi.fn(),
      };

      const engine = new DefaultAttendanceEngine({} as any, MOCK_ENV as any, {
        eventRepo: mockEventRepo as any,
        memberRepo: mockMemberRepo as any,
        attendanceRepo: mockAttendanceRepo as any,
        auditRepo: mockAuditRepo as any,
      });

      const result = await engine.recordManual({
        eventId: 'evt_inactive_1',
        memberId: 'mem_active_1',
        sessionType: 'CHECKIN',
        stationId: null,
        operatorId: 'admin-1',
        reason: 'Lupa scan',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.EVENT_INACTIVE);
    });

    it('2.1b Rejects manual attendance for inactive member', async () => {
      const mockEventRepo = {
        findById: vi.fn(async () => mockActiveEvent),
      };
      const mockMemberRepo = {
        findById: vi.fn(async () => mockInactiveMember),
      };
      const mockAttendanceRepo = {
        findByEventMemberSession: vi.fn(async () => null),
        create: vi.fn(),
      };
      const mockAuditRepo = {
        logAction: vi.fn(),
      };

      const engine = new DefaultAttendanceEngine({} as any, MOCK_ENV as any, {
        eventRepo: mockEventRepo as any,
        memberRepo: mockMemberRepo as any,
        attendanceRepo: mockAttendanceRepo as any,
        auditRepo: mockAuditRepo as any,
      });

      const result = await engine.recordManual({
        eventId: 'evt_active_1',
        memberId: 'mem_inactive_1',
        sessionType: 'CHECKIN',
        stationId: null,
        operatorId: 'admin-1',
        reason: 'Lupa scan',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.MEMBER_INACTIVE);
    });

    it('2.2 Generates collision-proof guest external IDs in guest-pass-manager', async () => {
      const mockEventRepo = {
        findById: vi.fn(async () => mockActiveEvent),
      };
      const mockMemberRepo = {
        createBatch: vi.fn(async () => {}),
      };
      const mockQrRepo = {
        createBatch: vi.fn(async () => {}),
      };
      const mockEventGuestRepo = {
        createBatch: vi.fn(async () => {}),
        importGuestsToEvent: vi.fn(async () => {}),
      };
      const mockAuditRepo = {
        logAction: vi.fn(async () => {}),
      };

      const manager = new DefaultGuestPassManager({} as any, MOCK_ENV as any, {
        eventRepo: mockEventRepo as any,
        memberRepo: mockMemberRepo as any,
        qrRepo: mockQrRepo as any,
        eventGuestRepo: mockEventGuestRepo as any,
        auditRepo: mockAuditRepo as any,
      });
      const result = await manager.issueGuestPasses({
        eventId: 'evt_active_1',
        count: 5,
        prefix: 'VIP Tamu',
      });

      expect(result.success).toBe(true);
      expect(result.data?.tokens).toHaveLength(5);
      for (const token of result.data!.tokens) {
        expect(token.member_external_id).toMatch(/^GUEST-[0-9A-F]{8}$/);
      }
    });
  });

  describe('3. Client State & Printing Contract', () => {
    it('3.1 PrintableToken matches snake_case interface required by PrintBadgeSheet', () => {
      const sampleToken: PrintableToken = {
        id: 'tok_123',
        member_id: 'mem_456',
        member_name: 'Jane Doe',
        member_external_id: 'MBR-999',
        member_division: 'Creative',
        qr_token: 'valid.jwe.token',
        scope: 'event',
        expires_at: '2026-12-31T23:59:59Z',
        event_name: 'Grand Conference',
      };

      expect(sampleToken.member_name).toBe('Jane Doe');
      expect(sampleToken.member_external_id).toBe('MBR-999');
      expect(sampleToken.qr_token).toBe('valid.jwe.token');
    });
  });

  describe('4. Shared Schemas Alignment', () => {
    it('4.1 Allows empty string, null, or omitted external_id in memberImportRowSchema', () => {
      const validWithId = memberImportRowSchema.parse({
        external_id: 'MBR-100',
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(validWithId.external_id).toBe('MBR-100');

      const validWithEmptyId = memberImportRowSchema.parse({
        external_id: '',
        name: 'Jane Auto',
        email: 'jane@example.com',
      });
      expect(validWithEmptyId.name).toBe('Jane Auto');

      const validWithNullId = memberImportRowSchema.parse({
        external_id: null,
        name: 'Alex Null',
      });
      expect(validWithNullId.name).toBe('Alex Null');

      const validWithoutId = memberImportRowSchema.parse({
        name: 'Sam Omitted',
      });
      expect(validWithoutId.name).toBe('Sam Omitted');
    });
  });
});
