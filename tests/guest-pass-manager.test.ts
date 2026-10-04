import { describe, it, expect, vi } from 'vitest';
import { DefaultGuestPassManager } from '../src/server/domain/guest/guest-pass-manager';
import { ErrorCode } from '../src/shared/constants/error-codes';
import { Event } from '../src/shared/types';

describe('DefaultGuestPassManager Domain Module', () => {
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
    id: 'evt_tech_conf',
    name: 'Tech Conference 2026',
    description: null,
    starts_at: '2026-06-01T08:00:00Z',
    ends_at: '2026-06-01T17:00:00Z',
    status: 'active',
    location_name: 'Hall A',
    allow_manual_attendance: 1,
    qr_policy: 'universal_allowed',
    grace_minutes: 30,
    created_at: '2026-01-01T00:00:00Z',
    session_modes: ['CHECKIN'],
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('generates guest passes with count and prefix', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockMemberRepo = {
      createBatch: vi.fn().mockResolvedValue(undefined),
    };
    const mockQrRepo = {
      createBatch: vi.fn().mockResolvedValue(undefined),
    };
    const mockEventGuestRepo = {
      importGuestsToEvent: vi.fn().mockResolvedValue(3),
    };
    const mockAuditRepo = {
      logAction: vi.fn().mockResolvedValue(undefined),
    };

    const manager = new DefaultGuestPassManager(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      memberRepo: mockMemberRepo as any,
      qrRepo: mockQrRepo as any,
      eventGuestRepo: mockEventGuestRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await manager.issueGuestPasses({
      eventId: 'evt_tech_conf',
      count: 3,
      prefix: 'VIP Guest',
      division: 'VIP Division',
      issuerId: 'adm_1',
    });

    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(3);
    expect(result.data?.tokens).toHaveLength(3);
    expect(result.data?.tokens[0].member_name).toBe('VIP Guest #01');
    expect(result.data?.tokens[0].member_division).toBe('VIP Division');
    expect(result.data?.tokens[0].scope).toBe('event');
    expect(result.data?.tokens[0].qr_token).toBeTruthy();

    expect(mockMemberRepo.createBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          division: 'VIP Division',
          status: 'active',
        }),
      ])
    );
    expect(mockQrRepo.createBatch).toHaveBeenCalledTimes(1);
    expect(mockEventGuestRepo.importGuestsToEvent).toHaveBeenCalledWith(
      'evt_tech_conf',
      expect.any(Array),
      'evt_tech_conf'
    );
    expect(mockAuditRepo.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_EVENT_GUEST_PASSES',
        entity_id: 'evt_tech_conf',
      })
    );
  });

  it('generates guest passes with explicit name list', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockMemberRepo = {
      createBatch: vi.fn().mockResolvedValue(undefined),
    };
    const mockQrRepo = {
      createBatch: vi.fn().mockResolvedValue(undefined),
    };
    const mockEventGuestRepo = {
      importGuestsToEvent: vi.fn().mockResolvedValue(2),
    };
    const mockAuditRepo = {
      logAction: vi.fn().mockResolvedValue(undefined),
    };

    const manager = new DefaultGuestPassManager(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      memberRepo: mockMemberRepo as any,
      qrRepo: mockQrRepo as any,
      eventGuestRepo: mockEventGuestRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await manager.issueGuestPasses({
      eventId: 'evt_tech_conf',
      guests: [
        { name: 'Dr. Jane Doe', division: 'Keynote Speaker', email: 'jane@example.com' },
        { name: 'John Smith', division: 'Panelist', phone: '0811223344' },
      ],
      issuerId: 'adm_1',
    });

    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(2);
    expect(result.data?.tokens[0].member_name).toBe('Dr. Jane Doe');
    expect(result.data?.tokens[0].member_division).toBe('Keynote Speaker');
    expect(result.data?.tokens[1].member_name).toBe('John Smith');
    expect(result.data?.tokens[1].member_division).toBe('Panelist');
  });

  it('rejects pass generation when event not found (404)', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(null),
    };
    const manager = new DefaultGuestPassManager(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
    });

    const result = await manager.issueGuestPasses({
      eventId: 'evt_unknown',
      count: 2,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.EVENT_NOT_FOUND);
    expect(result.error?.status_code).toBe(404);
  });

  it('rejects pass generation when guest list is empty (400)', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const manager = new DefaultGuestPassManager(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
    });

    const result = await manager.issueGuestPasses({
      eventId: 'evt_tech_conf',
      guests: [],
      count: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(result.error?.status_code).toBe(400);
  });

  it('imports prior guests into target event', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const mockEventGuestRepo = {
      importGuestsToEvent: vi.fn().mockResolvedValue(2),
    };
    const mockAuditRepo = {
      logAction: vi.fn().mockResolvedValue(undefined),
    };

    const manager = new DefaultGuestPassManager(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
      eventGuestRepo: mockEventGuestRepo as any,
      auditRepo: mockAuditRepo as any,
    });

    const result = await manager.importPriorGuests({
      targetEventId: 'evt_tech_conf',
      sourceEventId: 'evt_past_seminar',
      guestMemberIds: ['mem_guest_1', 'mem_guest_2'],
      issuerId: 'adm_1',
    });

    expect(result.success).toBe(true);
    expect(result.data?.imported_count).toBe(2);
    expect(result.data?.message).toContain('2');
    expect(mockEventGuestRepo.importGuestsToEvent).toHaveBeenCalledWith(
      'evt_tech_conf',
      ['mem_guest_1', 'mem_guest_2'],
      'evt_past_seminar',
      '2026-06-02T17:00:00.000Z'
    );
    expect(mockAuditRepo.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_EVENT_GUESTS',
        entity_id: 'evt_tech_conf',
      })
    );
  });

  it('rejects guest import if target event not found', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(null),
    };
    const manager = new DefaultGuestPassManager(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
    });

    const result = await manager.importPriorGuests({
      targetEventId: 'evt_nonexistent',
      guestMemberIds: ['mem_1'],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.EVENT_NOT_FOUND);
    expect(result.error?.status_code).toBe(404);
  });

  it('rejects guest import if member IDs array is empty', async () => {
    const mockEventRepo = {
      findById: vi.fn().mockResolvedValue(mockActiveEvent),
    };
    const manager = new DefaultGuestPassManager(createMockDb(), mockEnv, {
      eventRepo: mockEventRepo as any,
    });

    const result = await manager.importPriorGuests({
      targetEventId: 'evt_tech_conf',
      guestMemberIds: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(result.error?.status_code).toBe(400);
  });
});
