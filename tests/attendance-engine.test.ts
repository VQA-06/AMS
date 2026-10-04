import { describe, it, expect, vi } from 'vitest';
import { DefaultAttendanceEngine } from '../src/server/domain/attendance/attendance-engine';
import { ErrorCode } from '../src/shared/constants/error-codes';
import { generateQrToken } from '../src/server/crypto/qr-crypto';
import { SessionType, Event, Member, QrToken } from '../src/shared/types';

describe('DefaultAttendanceEngine Domain Module', () => {
  const TEST_BASE64_KEY = btoa('12345678901234567890123456789012');
  const mockEnv = {
    QR_ACTIVE_KID: 'k1',
    QR_KEY_K1: TEST_BASE64_KEY,
    APP_ISSUER: 'https://ams.ccunbaja.web.id',
    APP_AUDIENCE: 'ams',
  };

  const createMockDb = () =>
    ({
      prepare: vi.fn(),
      batch: vi.fn(),
    } as unknown as D1Database);

  const mockActiveEvent: Event = {
    id: 'evt_test_1',
    name: 'Tech Seminar 2026',
    description: null,
    starts_at: '2026-01-01T00:00:00Z',
    ends_at: '2026-12-31T23:59:59Z',
    status: 'active',
    location_name: 'Main Auditorium',
    allow_manual_attendance: 1,
    qr_policy: 'universal_allowed',
    grace_minutes: 30,
    session_modes: ['CHECKIN', 'CHECKOUT'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const mockActiveMember: Member = {
    id: 'mem_1',
    name: 'Budi Santoso',
    external_id: 'CC-001',
    email: 'budi@test.com',
    phone: '08123456789',
    division: 'Web Dev',
    group_name: 'Group A',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    metadata: {},
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('successfully records a valid attendance scan', async () => {
    const validFrom = new Date(Date.now() - 60000);
    const expiresAt = new Date(Date.now() + 3600000);

    const token = await generateQrToken(
      {
        memberId: 'mem_1',
        jti: 'jti_test_1',
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockMemberRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveMember),
    };
    const mockQrRepo = {
      findByJti: vi.fn().mockResolvedValue({
        id: 'tok_1',
        jti: 'jti_test_1',
        member_id: 'mem_1',
        scope: 'universal',
        revoked_at: null,
        max_uses: null,
        uses_count: 0,
      } as unknown as QrToken),
    };
    const mockAttendanceRepo = {
      findByEventMemberSession: vi.fn().mockResolvedValue(null),
      recordScanAtomic: vi.fn().mockResolvedValue(undefined),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
      logAction: vi.fn().mockResolvedValue(undefined),
    };
    const mockEventGuestRepo = {
      isGuestAuthorizedForEvent: vi.fn().mockResolvedValue(true),
    };

    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      memberRepo: mockMemberRepo as any,
      qrRepo: mockQrRepo as any,
      attendanceRepo: mockAttendanceRepo as any,
      auditRepo: mockAuditRepo as any,
      eventGuestRepo: mockEventGuestRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: 'stn_1',
      operatorId: 'adm_1',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('recorded');
    expect(result.attendance?.memberName).toBe('Budi Santoso');
    expect(result.attendance?.sessionType).toBe('CHECKIN');
    expect(result.participant?.id).toBe('mem_1');
    expect(mockAttendanceRepo.recordScanAtomic).toHaveBeenCalledTimes(1);
    expect(mockAuditRepo.recordFailedScan).not.toHaveBeenCalled();
  });

  it('rejects when event is not found (404)', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(null),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_nonexistent',
      qrToken: 'invalid.token',
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected');
    expect(result.error?.code).toBe(ErrorCode.EVENT_NOT_FOUND);
    expect(result.error?.status_code).toBe(404);
  });

  it('rejects when event is inactive', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue({
        ...mockActiveEvent,
        status: 'completed',
      }),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: 'invalid.token',
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.EVENT_INACTIVE);
    expect(result.error?.status_code).toBe(400);
    expect(mockAuditRepo.recordFailedScan).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: ErrorCode.EVENT_INACTIVE,
      })
    );
  });

  it('rejects when event has not started yet', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue({
        ...mockActiveEvent,
        starts_at: futureDate,
        grace_minutes: 30,
      }),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: 'dummy',
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.EVENT_NOT_STARTED);
    expect(result.error?.status_code).toBe(400);
  });

  it('rejects when event has ended', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue({
        ...mockActiveEvent,
        ends_at: pastDate,
        grace_minutes: 30,
      }),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: 'dummy',
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.EVENT_ENDED);
    expect(result.error?.status_code).toBe(400);
  });

  it('rejects invalid or corrupted QR token', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: 'not-a-valid-jwe-token',
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.status_code).toBe(400);
    expect(mockAuditRepo.recordFailedScan).toHaveBeenCalled();
  });

  it('rejects expired QR token', async () => {
    const validFrom = new Date(Date.now() - 7200000);
    const expiresAt = new Date(Date.now() - 3600000); // 1 hour ago

    const token = await generateQrToken(
      {
        memberId: 'mem_1',
        jti: 'jti_expired_1',
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.TOKEN_EXPIRED);
  });

  it('rejects token not in database', async () => {
    const token = await generateQrToken(
      {
        memberId: 'mem_1',
        jti: 'jti_missing_in_db',
        scope: 'universal',
        validFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockQrRepo = {
      findByJti: vi.fn().mockResolvedValue(null),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      qrRepo: mockQrRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.TOKEN_INVALID);
  });

  it('rejects revoked token', async () => {
    const token = await generateQrToken(
      {
        memberId: 'mem_1',
        jti: 'jti_revoked_1',
        scope: 'universal',
        validFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockQrRepo = {
      findByJti: vi.fn().mockResolvedValue({
        id: 'tok_1',
        jti: 'jti_revoked_1',
        revoked_at: '2026-01-01T12:00:00Z',
      } as unknown as QrToken),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      qrRepo: mockQrRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.TOKEN_REVOKED);
  });

  it('rejects single-use token when max_uses reached', async () => {
    const token = await generateQrToken(
      {
        memberId: 'mem_1',
        jti: 'jti_maxed_1',
        scope: 'universal',
        validFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockQrRepo = {
      findByJti: vi.fn().mockResolvedValue({
        id: 'tok_1',
        jti: 'jti_maxed_1',
        revoked_at: null,
        max_uses: 1,
        uses_count: 1,
      } as unknown as QrToken),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      qrRepo: mockQrRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.MAX_USES_EXCEEDED);
  });

  it('rejects inactive member', async () => {
    const token = await generateQrToken(
      {
        memberId: 'mem_inactive',
        jti: 'jti_inactive_mem',
        scope: 'universal',
        validFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockQrRepo = {
      findByJti: vi.fn().mockResolvedValue({
        id: 'tok_1',
        jti: 'jti_inactive_mem',
        revoked_at: null,
        max_uses: null,
        uses_count: 0,
      } as unknown as QrToken),
    };
    const mockMemberRepo = {
      findById: vi.fn().mockResolvedValue({
        ...mockActiveMember,
        status: 'suspended',
      }),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      qrRepo: mockQrRepo as any,
      memberRepo: mockMemberRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.MEMBER_INACTIVE);
  });

  it('rejects universal QR when event policy is event_only', async () => {
    const token = await generateQrToken(
      {
        memberId: 'mem_1',
        jti: 'jti_universal',
        scope: 'universal',
        validFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue({
        ...mockActiveEvent,
        qr_policy: 'event_only',
      }),
    };
    const mockQrRepo = {
      findByJti: vi.fn().mockResolvedValue({
        id: 'tok_1',
        jti: 'jti_universal',
        revoked_at: null,
        max_uses: null,
        uses_count: 0,
      } as unknown as QrToken),
    };
    const mockMemberRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveMember),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      qrRepo: mockQrRepo as any,
      memberRepo: mockMemberRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.UNIVERSAL_NOT_ALLOWED);
  });

  it('rejects duplicate attendance for the same session', async () => {
    const token = await generateQrToken(
      {
        memberId: 'mem_1',
        jti: 'jti_dup',
        scope: 'universal',
        validFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      mockEnv
    );

    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockQrRepo = {
      findByJti: vi.fn().mockResolvedValue({
        id: 'tok_1',
        jti: 'jti_dup',
        revoked_at: null,
        max_uses: null,
        uses_count: 0,
      } as unknown as QrToken),
    };
    const mockMemberRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveMember),
    };
    const mockAttendanceRepo = {
      findByEventMemberSession: vi.fn().mockResolvedValue({
        id: 'att_existing',
        event_id: 'evt_test_1',
        member_id: 'mem_1',
        session_type: 'CHECKIN',
      }),
    };
    const mockAuditRepo = {
      recordFailedScan: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      qrRepo: mockQrRepo as any,
      memberRepo: mockMemberRepo as any,
      attendanceRepo: mockAttendanceRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordScan({
      eventId: 'evt_test_1',
      qrToken: token,
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.ALREADY_SCANNED);
  });

  it('handles manual attendance recording successfully', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockMemberRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveMember),
    };
    const mockAttendanceRepo = {
      findByEventMemberSession: vi.fn().mockResolvedValue(null),
      recordManual: vi.fn().mockResolvedValue(undefined),
    };
    const mockAuditRepo = {
      logAction: vi.fn().mockResolvedValue(undefined),
    };

    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      memberRepo: mockMemberRepo as any,
      attendanceRepo: mockAttendanceRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await engine.recordManual({
      eventId: 'evt_test_1',
      memberId: 'mem_1',
      sessionType: 'CHECKIN' as SessionType,
      stationId: 'stn_1',
      operatorId: 'adm_1',
      reason: 'Physical card damaged',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('recorded');
    expect(result.attendance?.isManual).toBe(true);
    expect(result.attendance?.memberName).toBe('Budi Santoso');
    expect(mockAttendanceRepo.recordManual).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_test_1',
        memberId: 'mem_1',
        reason: 'Physical card damaged',
      })
    );
    expect(mockAuditRepo.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECORD_MANUAL_ATTENDANCE',
      })
    );
  });

  it('rejects manual attendance when event disallows manual check-ins', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue({
        ...mockActiveEvent,
        allow_manual_attendance: 0,
      }),
    };
    const engine = new DefaultAttendanceEngine(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
    });

    const result = await engine.recordManual({
      eventId: 'evt_test_1',
      memberId: 'mem_1',
      sessionType: 'CHECKIN' as SessionType,
      stationId: null,
      reason: 'Manual entry attempt',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.FORBIDDEN);
    expect(result.error?.status_code).toBe(400);
  });
});
