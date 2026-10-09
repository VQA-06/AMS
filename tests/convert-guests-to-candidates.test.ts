import { describe, it, expect } from 'vitest';
import app from '../src/server/index';
import { Env } from '../src/server/env';
import { createSessionToken } from '../src/server/crypto/session-crypto';
import { generateQrToken } from '../src/server/crypto/qr-crypto';
import { DefaultAttendanceEngine } from '../src/server/domain/attendance/attendance-engine';
import { MemberRepository } from '../src/server/repositories/member.repo';
import { AttendanceRepository } from '../src/server/repositories/attendance.repo';
import { EventRepository } from '../src/server/repositories/event.repo';
import { QrTokenRepository } from '../src/server/repositories/qr.repo';
import { AuditRepository } from '../src/server/repositories/audit.repo';
import { EventGuestRepository } from '../src/server/repositories/event-guest.repo';
import { convertGuestsToCandidatesSchema } from '../src/shared/schemas/member.schema';
import { ErrorCode } from '../src/shared/constants/error-codes';
import { Member, Event, QrToken, ApiResponse, ConvertGuestsResult, AttendedEventEntry } from '../src/shared/types';

describe('Guest-to-Candidate Migration & Continuity', () => {
  const TEST_BASE64_KEY = btoa('12345678901234567890123456789012');
  const SESSION_SECRET = 'super-secure-session-secret-key-32b!';

  const mockEnv = {
    QR_ACTIVE_KID: 'k1',
    QR_KEY_K1: TEST_BASE64_KEY,
    APP_ISSUER: 'https://ams.ccunbaja.web.id',
    APP_AUDIENCE: 'ams',
    SESSION_SECRET,
    ENABLE_GUEST_CONVERSION: 'true',
  };

  const adminUser = {
    id: 'adm_1',
    email: 'admin@absen.local',
    name: 'Super Admin',
    role: 'admin',
    status: 'active',
  };

  // 1. Schema Validation Tests
  describe('convertGuestsToCandidatesSchema', () => {
    it('accepts valid guest migration payload', () => {
      const payload = {
        guest_member_ids: ['mem_guest1', 'mem_guest2'],
        target_group: 'Angkatan 2026',
        target_division: 'Divisi IT',
      };
      const parsed = convertGuestsToCandidatesSchema.parse(payload);
      expect(parsed.guest_member_ids).toEqual(['mem_guest1', 'mem_guest2']);
      expect(parsed.target_group).toBe('Angkatan 2026');
      expect(parsed.target_division).toBe('Divisi IT');
    });

    it('rejects empty guest_member_ids array', () => {
      expect(() =>
        convertGuestsToCandidatesSchema.parse({
          guest_member_ids: [],
        })
      ).toThrow();
    });
  });

  // 2. MemberRepository convertGuestsToCandidates Tests
  describe('MemberRepository.convertGuestsToCandidates', () => {
    it('migrates guest to candidate, updates external_id, cleans metadata, and uncaps QR tokens', async () => {
      const guestMember: Member = {
        id: 'mem_guest_99',
        external_id: 'GUEST-443322',
        name: 'Budi Santoso',
        email: 'budi@example.com',
        phone: '081234567890',
        group_name: 'Tamu: Seminar AI',
        division: null,
        status: 'active',
        metadata: JSON.stringify({ temporary: true, event_id: 'ev_old_seminar' }),
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const capturedStatements: Array<{ sql: string; params: unknown[] }> = [];

      const mockDb = {
        prepare: (sql: string) => {
          return {
            bind: (...bound: unknown[]) => ({
              sql,
              params: bound,
              first: async () => guestMember,
              all: async () => ({ results: [guestMember] }),
              run: async () => {
                capturedStatements.push({ sql, params: bound });
                return { success: true };
              },
            }),
            first: async () => guestMember,
            all: async () => ({ results: [guestMember] }),
            run: async () => {
              capturedStatements.push({ sql, params: [] });
              return { success: true };
            },
          };
        },
        batch: async (stmts: Array<{ sql: string; params: unknown[] }>) => {
          capturedStatements.push(...stmts);
          return [];
        },
      } as unknown as D1Database;

      const repo = new MemberRepository(mockDb);
      const result = await repo.convertGuestsToCandidates(['mem_guest_99'], {
        targetGroup: 'Calon Anggota 2026',
        division: 'Divisi Acara',
      });

      expect(result.converted_count).toBe(1);
      expect(result.converted_ids).toEqual(['mem_guest_99']);

      // Check captured statements for member update and QR token uncap
      const memberUpdate = capturedStatements.find((s) => s.sql.includes('UPDATE members'));
      expect(memberUpdate).toBeDefined();
      if (memberUpdate) {
        const [newExtId, groupName, division, metadataJson, id] = memberUpdate.params as string[];
        expect(newExtId.startsWith('CAD-')).toBe(true);
        expect(groupName).toBe('Calon Anggota 2026');
        expect(division).toBe('Divisi Acara');
        expect(id).toBe('mem_guest_99');

        const parsedMeta = JSON.parse(metadataJson);
        expect(parsedMeta.temporary).toBeUndefined();
        expect(parsedMeta.event_id).toBeUndefined();
        expect(parsedMeta.converted_from_guest).toBe(true);
        expect(parsedMeta.previous_external_id).toBe('GUEST-443322');
      }

      const qrUpdate = capturedStatements.find((s) => s.sql.includes('UPDATE qr_tokens'));
      expect(qrUpdate).toBeDefined();
      if (qrUpdate) {
        expect(qrUpdate.sql).toContain('max_uses = NULL');
        expect(qrUpdate.sql).toContain("expires_at = '2099-12-31T23:59:59.999Z'");
        expect(qrUpdate.params).toEqual(['mem_guest_99']);
      }
    });
  });

  // 3. QR Token Continuity & Cross-Event Scan Verification
  describe('Attendance Engine QR Continuity for Converted Candidates', () => {
    it('allows a converted candidate with legacy event-scoped token to scan at any universal-allowed event', async () => {
      const candidateMember: Member = {
        id: 'mem_candidate_1',
        external_id: 'CAD-123456',
        name: 'Dewi Lestari',
        email: 'dewi@example.com',
        phone: null,
        group_name: 'Calon Anggota',
        division: 'Divisi Logistik',
        status: 'candidate',
        metadata: JSON.stringify({ converted_from_guest: true }),
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const eventB: Event = {
        id: 'ev_workshop_2',
        name: 'Workshop Web Dev',
        description: null,
        location_name: 'Lab Komputer',
        starts_at: '2026-01-01T00:00:00Z',
        ends_at: '2099-12-31T23:59:59Z',
        qr_policy: 'universal_allowed',
        status: 'active',
        session_modes: '["CHECKIN"]',
        allow_manual_attendance: 1,
        grace_minutes: 15,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      // Legacy token issued during event A
      const legacyTokenString = await generateQrToken(
        {
          memberId: 'mem_candidate_1',
          jti: 'jti_legacy_guest_token',
          scope: 'event',
          eventId: 'ev_past_event_1',
          validFrom: '2026-01-01T00:00:00Z',
          expiresAt: '2099-12-31T23:59:59.999Z',
          issuer: mockEnv.APP_ISSUER,
          audience: mockEnv.APP_AUDIENCE,
          kid: 'k1',
        },
        mockEnv
      );

      const qrTokenRecord: QrToken = {
        id: 'tok_legacy_1',
        jti: 'jti_legacy_guest_token',
        member_id: 'mem_candidate_1',
        event_id: 'ev_past_event_1',
        scope: 'event',
        valid_from: '2026-01-01T00:00:00Z',
        expires_at: '2099-12-31T23:59:59.999Z',
        max_uses: null, // uncapped during conversion
        uses_count: 1,
        revoked_at: null,
        created_by: null,
        note: null,
        created_at: '2026-01-01T00:00:00Z',
      };

      const memberRepo = {
        findById: async (id: string) => (id === candidateMember.id ? candidateMember : null),
      } as unknown as MemberRepository;

      const eventRepo = {
        findById: async (id: string) => (id === eventB.id ? eventB : null),
      } as unknown as EventRepository;

      const qrRepo = {
        findByJti: async (jti: string) => (jti === qrTokenRecord.jti ? qrTokenRecord : null),
        incrementUses: async () => {},
      } as unknown as QrTokenRepository;

      const attendanceRepo = {
        findByEventMemberSession: async () => null,
        recordScanAtomic: async () => {},
      } as unknown as AttendanceRepository;
      const auditRepo = {
        recordFailedScan: async () => {},
      } as unknown as AuditRepository;

      const eventGuestRepo = {
        isGuestAuthorizedForEvent: async () => false,
      } as unknown as EventGuestRepository;

      const mockDb = {} as unknown as D1Database;
      const engine = new DefaultAttendanceEngine(mockDb, mockEnv, {
        attendanceRepo,
        eventRepo,
        memberRepo,
        qrRepo,
        auditRepo,
        eventGuestRepo,
      });

      const scanResult = await engine.recordScan({
        eventId: 'ev_workshop_2',
        qrToken: legacyTokenString,
        sessionType: 'CHECKIN',
        stationId: 'station_1',
      });

      expect(scanResult.success).toBe(true);
      expect(scanResult.status).toBe('recorded');
      expect(scanResult.participant?.name).toBe('Dewi Lestari');
      expect(scanResult.participant?.is_guest).toBe(false);
    });

    it('rejects a non-converted guest scanning an event token at a different event', async () => {
      const guestMember: Member = {
        id: 'mem_guest_only',
        external_id: 'GUEST-112233',
        name: 'Tamu Asing',
        email: null,
        phone: null,
        group_name: 'Tamu: Acara A',
        division: null,
        status: 'active',
        metadata: JSON.stringify({ temporary: true, event_id: 'ev_event_a' }),
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const eventB: Event = {
        id: 'ev_event_b',
        name: 'Acara B',
        description: null,
        location_name: 'Aula',
        starts_at: '2026-01-01T00:00:00Z',
        ends_at: '2099-12-31T23:59:59Z',
        qr_policy: 'universal_allowed',
        status: 'active',
        session_modes: '["CHECKIN"]',
        allow_manual_attendance: 1,
        grace_minutes: 15,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const tokenString = await generateQrToken(
        {
          memberId: 'mem_guest_only',
          jti: 'jti_guest_only_tok',
          scope: 'event',
          eventId: 'ev_event_a',
          validFrom: '2026-01-01T00:00:00Z',
          expiresAt: '2099-12-31T23:59:59.999Z',
          issuer: mockEnv.APP_ISSUER,
          audience: mockEnv.APP_AUDIENCE,
          kid: 'k1',
        },
        mockEnv
      );

      const qrTokenRecord: QrToken = {
        id: 'tok_guest_only_1',
        jti: 'jti_guest_only_tok',
        member_id: 'mem_guest_only',
        event_id: 'ev_event_a',
        scope: 'event',
        valid_from: '2026-01-01T00:00:00Z',
        expires_at: '2099-12-31T23:59:59.999Z',
        max_uses: 1,
        uses_count: 0,
        revoked_at: null,
        created_by: null,
        note: null,
        created_at: '2026-01-01T00:00:00Z',
      };

      const memberRepo = {
        findById: async (id: string) => (id === guestMember.id ? guestMember : null),
      } as unknown as MemberRepository;

      const eventRepo = {
        findById: async (id: string) => (id === eventB.id ? eventB : null),
      } as unknown as EventRepository;

      const qrRepo = {
        findByJti: async (jti: string) => (jti === qrTokenRecord.jti ? qrTokenRecord : null),
      } as unknown as QrTokenRepository;

      const attendanceRepo = {
        findByEventMemberSession: async () => null,
        recordScanAtomic: async () => {},
      } as unknown as AttendanceRepository;
      const auditRepo = { recordFailedScan: async () => {} } as unknown as AuditRepository;
      const eventGuestRepo = { isGuestAuthorizedForEvent: async () => false } as unknown as EventGuestRepository;
      const mockDb = {} as unknown as D1Database;
      const engine = new DefaultAttendanceEngine(mockDb, mockEnv, {
        attendanceRepo,
        eventRepo,
        memberRepo,
        qrRepo,
        auditRepo,
        eventGuestRepo,
      });

      const scanResult = await engine.recordScan({
        eventId: 'ev_event_b',
        qrToken: tokenString,
        sessionType: 'CHECKIN',
        stationId: 'station_1',
      });

      expect(scanResult.success).toBe(false);
      expect(scanResult.error?.code).toBe(ErrorCode.WRONG_EVENT);
    });
  });

  // 4. AttendanceRepository listMemberAttendedEvents Tests
  describe('AttendanceRepository.listMemberAttendedEvents', () => {
    it('queries and returns attended events ordered by scanned_at descending', async () => {
      const mockEvents: AttendedEventEntry[] = [
        {
          event_id: 'ev_2',
          event_name: 'Seminar AI & Data',
          event_location: 'Auditorium',
          starts_at: '2026-02-01T09:00:00Z',
          ends_at: '2026-02-01T12:00:00Z',
          attended_at: '2026-02-01T09:15:00Z',
          session_type: 'CHECKIN',
          method: 'QR_SCAN',
        },
        {
          event_id: 'ev_1',
          event_name: 'Makrab Calon Anggota',
          event_location: 'Villa Wisata',
          starts_at: '2026-01-15T08:00:00Z',
          ends_at: '2026-01-16T17:00:00Z',
          attended_at: '2026-01-15T08:10:00Z',
          session_type: 'CHECKIN',
          method: 'QR_SCAN',
        },
      ];

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (memberId: string) => ({
            all: async () => {
              expect(memberId).toBe('mem_cand_1');
              return { results: mockEvents };
            },
          }),
        }),
      } as unknown as D1Database;

      const repo = new AttendanceRepository(mockDb);
      const result = await repo.listMemberAttendedEvents('mem_cand_1');

      expect(result).toHaveLength(2);
      expect(result[0].event_name).toBe('Seminar AI & Data');
      expect(result[1].event_name).toBe('Makrab Calon Anggota');
    });
  });

  // 5. Server Route & Dev Var Toggle Integration Tests
  describe('Server API Endpoints & ENABLE_GUEST_CONVERSION Flag', () => {
    it('rejects conversion with 403 Forbidden when ENABLE_GUEST_CONVERSION="false"', async () => {
      const adminToken = await createSessionToken(
        {
          email: 'admin@absen.local',
          role: 'admin',
        },
        SESSION_SECRET
      );

      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('admins')) return adminUser;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
          first: async () => {
            if (sql.includes('admins')) return adminUser;
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      } as unknown as D1Database;

      const req = new Request('http://localhost/api/members/candidates/convert-from-guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          guest_member_ids: ['mem_guest_1'],
          target_group: 'Calon 2026',
        }),
      });

      const res = await app.request(req, {}, {
        ...mockEnv,
        ENABLE_GUEST_CONVERSION: 'false',
        DB: mockDb,
      } as unknown as Env);

      expect(res.status).toBe(403);
      const json = await res.json<ApiResponse>();
      expect(json.ok).toBe(false);
      expect(json.error?.code).toBe(ErrorCode.FORBIDDEN);
      expect(json.error?.message).toContain('dinonaktifkan oleh konfigurasi server');
    });

    it('returns 200 OK and converts guests when ENABLE_GUEST_CONVERSION="true"', async () => {
      const adminToken = await createSessionToken(
        {
          email: 'admin@absen.local',
          role: 'admin',
        },
        SESSION_SECRET
      );

      const guestRecord: Member = {
        id: 'mem_g_1',
        external_id: 'GUEST-998877',
        name: 'Ahmad Fauzi',
        email: 'ahmad@example.com',
        phone: null,
        group_name: 'Tamu: Expo 2026',
        division: null,
        status: 'active',
        metadata: JSON.stringify({ temporary: true }),
        created_at: '',
        updated_at: '',
      };

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...bound: unknown[]) => ({
            first: async () => {
              if (sql.includes('admins')) return adminUser;
              return guestRecord;
            },
            all: async () => ({ results: [guestRecord] }),
            run: async () => ({ success: true }),
          }),
          first: async () => {
            if (sql.includes('admins')) return adminUser;
            return guestRecord;
          },
          all: async () => ({ results: [guestRecord] }),
          run: async () => ({ success: true }),
        }),
        batch: async () => [],
      } as unknown as D1Database;

      const req = new Request('http://localhost/api/members/candidates/convert-from-guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          guest_member_ids: ['mem_g_1'],
          target_group: 'Angkatan 2026',
          target_division: 'Humas',
        }),
      });

      const res = await app.request(req, {}, {
        ...mockEnv,
        ENABLE_GUEST_CONVERSION: 'true',
        DB: mockDb,
      } as unknown as Env);

      expect(res.status).toBe(200);
      const json = await res.json<ApiResponse<ConvertGuestsResult>>();
      expect(json.ok).toBe(true);
      expect(json.data?.converted_count).toBe(1);
      expect(json.data?.converted_ids).toEqual(['mem_g_1']);
    });

    it('returns attended events via GET /api/members/:id/attended-events', async () => {
      const adminToken = await createSessionToken(
        {
          email: 'admin@absen.local',
          role: 'admin',
        },
        SESSION_SECRET
      );

      const memberRecord: Member = {
        id: 'mem_target_1',
        external_id: 'CAD-112233',
        name: 'Siti Nurhaliza',
        email: 'siti@example.com',
        phone: null,
        group_name: 'Calon Anggota',
        division: 'Acara',
        status: 'candidate',
        metadata: '{}',
        created_at: '',
        updated_at: '',
      };

      const mockEvents: AttendedEventEntry[] = [
        {
          event_id: 'ev_1',
          event_name: 'Orientasi 2026',
          event_location: 'Gedung A',
          starts_at: '2026-03-01T08:00:00Z',
          ends_at: '2026-03-01T12:00:00Z',
          attended_at: '2026-03-01T08:15:00Z',
          session_type: 'CHECKIN',
          method: 'QR_SCAN',
        },
      ];

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...bound: unknown[]) => ({
            first: async () => {
              if (sql.includes('admins')) return adminUser;
              return memberRecord;
            },
            all: async () => ({ results: mockEvents }),
            run: async () => ({ success: true }),
          }),
          first: async () => {
            if (sql.includes('admins')) return adminUser;
            return memberRecord;
          },
          all: async () => ({ results: mockEvents }),
          run: async () => ({ success: true }),
        }),
      } as unknown as D1Database;

      const req = new Request('http://localhost/api/members/mem_target_1/attended-events', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const res = await app.request(req, {}, {
        ...mockEnv,
        DB: mockDb,
      } as unknown as Env);

      expect(res.status).toBe(200);
      const json = await res.json<ApiResponse<AttendedEventEntry[]>>();
      expect(json.ok).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data?.[0].event_name).toBe('Orientasi 2026');
    });
  });
});
