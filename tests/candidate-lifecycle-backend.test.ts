import { describe, it, expect } from 'vitest';
import app from '../src/server/index';
import { createSessionToken } from '../src/server/crypto/session-crypto';
import { generateQrToken } from '../src/server/crypto/qr-crypto';
import { DefaultAttendanceEngine } from '../src/server/domain/attendance/attendance-engine';
import { MemberRepository } from '../src/server/repositories/member.repo';
import { AttendanceRepository } from '../src/server/repositories/attendance.repo';
import {
  memberSchema,
  memberUpdateSchema,
  memberImportRowSchema,
  candidateInductionSchema,
  candidateBatchActionSchema,
  candidatePurgeSchema,
} from '../src/shared/schemas/member.schema';
import { ErrorCode } from '../src/shared/constants/error-codes';
import { Member, Event, QrToken, ApiResponse, CandidateInductionResult } from '../src/shared/types';

describe('Candidate Member Lifecycle & Induction Backend', () => {
  const TEST_BASE64_KEY = btoa('12345678901234567890123456789012');
  const SESSION_SECRET = 'super-secure-session-secret-key-32b!';

  const mockEnv = {
    QR_ACTIVE_KID: 'k1',
    QR_KEY_K1: TEST_BASE64_KEY,
    APP_ISSUER: 'https://ams.ccunbaja.web.id',
    APP_AUDIENCE: 'ams',
    SESSION_SECRET,
  };

  // 1. Validation Schemas Test
  describe('Schema Validation', () => {
    it('accepts candidate and archived statuses in member schemas', () => {
      const candidateData = {
        name: 'Calon Anggota 1',
        status: 'candidate' as const,
        group_name: 'Batch 2026',
        division: 'Divisi IT',
      };
      const parsedCandidate = memberSchema.parse(candidateData);
      expect(parsedCandidate.status).toBe('candidate');

      const archivedData = {
        name: 'Anggota Diarsipkan',
        status: 'archived' as const,
      };
      const parsedArchived = memberUpdateSchema.parse(archivedData);
      expect(parsedArchived.status).toBe('archived');

      const importRow = {
        name: 'Calon Anggota Import',
        status: 'candidate' as const,
      };
      const parsedImport = memberImportRowSchema.parse(importRow);
      expect(parsedImport.status).toBe('candidate');
    });

    it('validates candidateInductionSchema, candidateBatchActionSchema, candidatePurgeSchema', () => {
      // Induction schema
      const validInduction = candidateInductionSchema.parse({
        member_ids: ['mem_1', 'mem_2'],
        archive_remaining: true,
        batch_group: 'Batch 2026',
        division: 'Divisi Web',
      });
      expect(validInduction.member_ids).toEqual(['mem_1', 'mem_2']);
      expect(validInduction.archive_remaining).toBe(true);

      expect(() => candidateInductionSchema.parse({ member_ids: [] })).toThrow();

      // Batch action schema
      const validBatch = candidateBatchActionSchema.parse({
        member_ids: ['mem_1'],
        batch_group: 'Batch 2026',
      });
      expect(validBatch.member_ids).toEqual(['mem_1']);

      // Purge schema
      const validPurgeIds = candidatePurgeSchema.parse({
        member_ids: ['mem_archived_1'],
      });
      expect(validPurgeIds.member_ids).toEqual(['mem_archived_1']);

      const validPurgeAll = candidatePurgeSchema.parse({
        all_archived: true,
      });
      expect(validPurgeAll.all_archived).toBe(true);

      expect(() => candidatePurgeSchema.parse({})).toThrow();
    });
  });

  // 2. MemberRepository Candidate Operations
  describe('MemberRepository Candidate Lifecycle Operations', () => {
    it('accurately calculates candidate and archived counts in getMemberStatsSummary', async () => {
      let executedSql = '';
      const mockDb = {
        prepare: (sql: string) => {
          executedSql = sql;
          return {
            first: async () => ({
              total: 10,
              active: 5,
              inactive: 2,
              candidate: 2,
              archived: 1,
            }),
          };
        },
      } as unknown as D1Database;

      const repo = new MemberRepository(mockDb);
      const summary = await repo.getMemberStatsSummary();

      expect(summary.total).toBe(10);
      expect(summary.active).toBe(5);
      expect(summary.inactive).toBe(2);
      expect(summary.candidate).toBe(2);
      expect(summary.archived).toBe(1);
      expect(executedSql).toContain("COUNT(CASE WHEN status = 'candidate' THEN 1 END) as candidate");
      expect(executedSql).toContain("COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived");
    });

    it('inducts candidates and sweeps remaining candidates to archived when archiveRemaining is true', async () => {
      const candidatesInDb: Member[] = [
        {
          id: 'cand_1',
          external_id: 'CAND-001',
          name: 'Calon 1',
          email: 'calon1@test.com',
          phone: null,
          group_name: 'Batch 2026',
          division: null,
          status: 'candidate',
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'cand_2',
          external_id: 'CAND-002',
          name: 'Calon 2',
          email: 'calon2@test.com',
          phone: null,
          group_name: 'Batch 2026',
          division: null,
          status: 'candidate',
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'cand_3',
          external_id: 'CAND-003',
          name: 'Calon 3',
          email: 'calon3@test.com',
          phone: null,
          group_name: 'Batch 2026',
          division: null,
          status: 'candidate',
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const executedBatchStatements: Array<{ sql: string; params: unknown[] }> = [];

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql,
            params,
            all: async () => {
              if (sql.includes("status = 'candidate'")) {
                return { results: candidatesInDb };
              }
              const requestedIds = params as string[];
              return { results: candidatesInDb.filter((c) => requestedIds.includes(c.id)) };
            },
          }),
        }),
        batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
          for (const s of statements) {
            executedBatchStatements.push(s);
          }
          return statements.map(() => ({ success: true, meta: { changes: 1 } }));
        },
      } as unknown as D1Database;

      const repo = new MemberRepository(mockDb);

      // Induct cand_1 and cand_2, sweep remaining cand_3 to archived
      const result = await repo.inductCandidates({
        memberIds: ['cand_1', 'cand_2'],
        archiveRemaining: true,
        batchGroup: 'Batch 2026',
        division: 'Divisi Pengembangan',
      });

      expect(result.promoted_count).toBe(2);
      expect(result.promoted_ids).toEqual(['cand_1', 'cand_2']);
      expect(result.archived_count).toBe(1);
      expect(result.archived_ids).toEqual(['cand_3']);

      expect(executedBatchStatements.length).toBe(3);
      // First 2 updates should set status = 'active' and division = 'Divisi Pengembangan'
      expect(executedBatchStatements[0].sql).toContain("status = 'active'");
      expect(executedBatchStatements[0].params[0]).toBe('Divisi Pengembangan');
      expect(executedBatchStatements[0].params[2]).toBe('cand_1');

      expect(executedBatchStatements[1].sql).toContain("status = 'active'");
      expect(executedBatchStatements[1].params[0]).toBe('Divisi Pengembangan');
      expect(executedBatchStatements[1].params[2]).toBe('cand_2');

      // Third update should set status = 'archived' for cand_3
      expect(executedBatchStatements[2].sql).toContain("status = 'archived'");
      expect(executedBatchStatements[2].params[1]).toBe('cand_3');
    });

    it('archives and restores candidates via batch actions', async () => {
      const candidates: Member[] = [
        {
          id: 'cand_1',
          external_id: 'CAND-001',
          name: 'Calon 1',
          email: null,
          phone: null,
          group_name: 'Batch 2026',
          division: null,
          status: 'candidate',
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const archived: Member[] = [
        {
          id: 'cand_archived_1',
          external_id: 'CAND-002',
          name: 'Calon Diarsipkan',
          email: null,
          phone: null,
          group_name: 'Batch 2026',
          division: null,
          status: 'archived',
          metadata: { archived_at: '2026-01-01T00:00:00Z', archived_from: 'candidate' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const executedBatchStatements: Array<{ sql: string; params: unknown[] }> = [];

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql,
            params,
            all: async () => {
              const requestedIds = params as string[];
              const matched = [...candidates, ...archived].filter((c) => requestedIds.includes(c.id));
              return { results: matched };
            },
          }),
        }),
        batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
          for (const s of statements) {
            executedBatchStatements.push(s);
          }
          return statements.map(() => ({ success: true, meta: { changes: 1 } }));
        },
      } as unknown as D1Database;

      const repo = new MemberRepository(mockDb);

      // Archive cand_1
      const archiveRes = await repo.archiveCandidates(['cand_1']);
      expect(archiveRes.count).toBe(1);
      expect(archiveRes.archived_ids).toEqual(['cand_1']);

      // Restore cand_archived_1
      const restoreRes = await repo.restoreArchived(['cand_archived_1']);
      expect(restoreRes.count).toBe(1);
      expect(restoreRes.restored_ids).toEqual(['cand_archived_1']);
      expect(executedBatchStatements[1].sql).toContain("status = 'candidate'");
    });

    it('purges archived members and deletes associated relational rows', async () => {
      const archivedMembers: Member[] = [
        {
          id: 'archived_1',
          external_id: 'CAND-ARCHIVED',
          name: 'Calon Terhapus',
          email: null,
          phone: null,
          group_name: 'Batch 2026',
          division: null,
          status: 'archived',
          metadata: {},
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const executedBatchStatements: Array<{ sql: string; params: unknown[] }> = [];

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql,
            params,
            all: async () => {
              if (sql.includes("status = 'archived'")) {
                return { results: archivedMembers.map((m) => ({ id: m.id })) };
              }
              const requestedIds = params as string[];
              return { results: archivedMembers.filter((m) => requestedIds.includes(m.id)) };
            },
          }),
          all: async () => ({ results: archivedMembers.map((m) => ({ id: m.id })) }),
        }),
        batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
          for (const s of statements) {
            executedBatchStatements.push(s);
          }
          return statements.map(() => ({ success: true, meta: { changes: 1 } }));
        },
      } as unknown as D1Database;

      const repo = new MemberRepository(mockDb);

      const purgeRes = await repo.purgeArchived(['archived_1']);
      expect(purgeRes.count).toBe(1);
      expect(purgeRes.purged_ids).toEqual(['archived_1']);

      // Verify cascading delete statements were batched
      const deletedTables = executedBatchStatements.map((s) => s.sql);
      expect(deletedTables.some((q) => q.includes('DELETE FROM members'))).toBe(true);
      expect(deletedTables.some((q) => q.includes('DELETE FROM qr_tokens'))).toBe(true);
      expect(deletedTables.some((q) => q.includes('DELETE FROM attendances'))).toBe(true);
    });
  });

  // 3. Attendance Domain Engine for Candidates
  describe('Attendance Engine with Candidate Status', () => {
    const mockActiveEvent: Event = {
      id: 'evt_pembekalan_2026',
      name: 'Pembekalan Calon Anggota 2026',
      description: null,
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-12-31T23:59:59Z',
      status: 'active',
      location_name: 'Lab Komputer',
      allow_manual_attendance: 1,
      qr_policy: 'universal_allowed',
      grace_minutes: 30,
      session_modes: ['CHECKIN', 'CHECKOUT'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const mockCandidateMember: Member = {
      id: 'mem_candidate_1',
      name: 'Ahmad Fauzi (Calon)',
      external_id: 'CAND-001',
      email: 'fauzi@test.com',
      phone: null,
      division: 'Divisi Web',
      group_name: 'Batch 2026',
      status: 'candidate',
      created_at: '2026-01-01T00:00:00Z',
      metadata: {},
      updated_at: '2026-01-01T00:00:00Z',
    };

    const mockArchivedMember: Member = {
      id: 'mem_archived_1',
      name: 'Rian (Arsip)',
      external_id: 'CAND-002',
      email: 'rian@test.com',
      phone: null,
      division: null,
      group_name: 'Batch 2026',
      status: 'archived',
      created_at: '2026-01-01T00:00:00Z',
      metadata: {},
      updated_at: '2026-01-01T00:00:00Z',
    };

    const mockQrToken: QrToken = {
      id: 'tok_candidate_1',
      jti: 'jti_candidate_001',
      member_id: 'mem_candidate_1',
      event_id: null,
      scope: 'universal',
      valid_from: '2026-01-01T00:00:00Z',
      expires_at: '2099-12-31T23:59:59Z',
      max_uses: null,
      uses_count: 0,
      revoked_at: null,
      created_by: null,
      note: null,
      created_at: '2026-01-01T00:00:00Z',
    };

    const mockArchivedQrToken: QrToken = {
      id: 'tok_archived_1',
      jti: 'jti_archived_001',
      member_id: 'mem_archived_1',
      event_id: null,
      scope: 'universal',
      valid_from: '2026-01-01T00:00:00Z',
      expires_at: '2099-12-31T23:59:59Z',
      max_uses: null,
      uses_count: 0,
      revoked_at: null,
      created_by: null,
      note: null,
      created_at: '2026-01-01T00:00:00Z',
    };

    it('successfully scans and records attendance for candidate member', async () => {
      const validFrom = new Date(Date.now() - 60000);
      const expiresAt = new Date(Date.now() + 3600000);

      const tokenString = await generateQrToken(
        {
          memberId: 'mem_candidate_1',
          jti: 'jti_candidate_001',
          scope: 'universal',
          validFrom: validFrom.toISOString(),
          expiresAt: expiresAt.toISOString(),
          issuer: mockEnv.APP_ISSUER,
          audience: mockEnv.APP_AUDIENCE,
          kid: 'k1',
        },
        mockEnv
      );

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql,
            params,
            first: async () => {
              if (sql.includes('events WHERE id = ?')) return mockActiveEvent;
              if (sql.includes('qr_tokens') && (sql.includes('jti = ?') || sql.includes('q.jti = ?'))) {
                return {
                  ...mockQrToken,
                  member_name: mockCandidateMember.name,
                  member_external_id: mockCandidateMember.external_id,
                  member_division: mockCandidateMember.division,
                  event_name: mockActiveEvent.name,
                };
              }
              if (sql.includes('members') && sql.includes('id = ?')) return mockCandidateMember;
              if (sql.includes('attendances WHERE event_id = ?')) return null;
              return null;
            },
            run: async () => ({ success: true, meta: { changes: 1 } }),
          }),
        }),
        batch: async () => [{ success: true }],
      } as unknown as D1Database;

      const engine = new DefaultAttendanceEngine(mockDb, mockEnv);
      const res = await engine.recordScan({
        eventId: 'evt_pembekalan_2026',
        qrToken: tokenString,
        sessionType: 'CHECKIN',
        stationId: 'stn_1',
        operatorId: 'adm_1',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('recorded');
    });

    it('rejects attendance scan for archived member with MEMBER_INACTIVE', async () => {
      const validFrom = new Date(Date.now() - 60000);
      const expiresAt = new Date(Date.now() + 3600000);

      const tokenString = await generateQrToken(
        {
          memberId: 'mem_archived_1',
          jti: 'jti_archived_001',
          scope: 'universal',
          validFrom: validFrom.toISOString(),
          expiresAt: expiresAt.toISOString(),
          issuer: mockEnv.APP_ISSUER,
          audience: mockEnv.APP_AUDIENCE,
          kid: 'k1',
        },
        mockEnv
      );

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql,
            params,
            first: async () => {
              if (sql.includes('events WHERE id = ?')) return mockActiveEvent;
              if (sql.includes('qr_tokens') && (sql.includes('jti = ?') || sql.includes('q.jti = ?'))) {
                return {
                  ...mockArchivedQrToken,
                  member_name: mockArchivedMember.name,
                  member_external_id: mockArchivedMember.external_id,
                  member_division: mockArchivedMember.division,
                  event_name: mockActiveEvent.name,
                };
              }
              if (sql.includes('members') && sql.includes('id = ?')) return mockArchivedMember;
              return null;
            },
            run: async () => ({ success: true }),
          }),
        }),
        batch: async () => [{ success: true }],
      } as unknown as D1Database;

      const engine = new DefaultAttendanceEngine(mockDb, mockEnv);
      const res = await engine.recordScan({
        eventId: 'evt_pembekalan_2026',
        qrToken: tokenString,
        sessionType: 'CHECKIN',
        stationId: 'stn_1',
        operatorId: 'adm_1',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('rejected');
      expect(res.error?.code).toBe(ErrorCode.MEMBER_INACTIVE);
    });

    it('allows candidate manual checkin and rejects archived manual checkin', async () => {
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql,
            params,
            first: async () => {
              if (sql.includes('events WHERE id = ?')) return mockActiveEvent;
              if (sql.includes('members WHERE id = ?')) {
                if (params[0] === 'mem_candidate_1') return mockCandidateMember;
                if (params[0] === 'mem_archived_1') return mockArchivedMember;
              }
              if (sql.includes('attendances WHERE event_id = ?')) return null;
              return null;
            },
            run: async () => ({ success: true }),
          }),
        }),
        batch: async () => [{ success: true }],
      } as unknown as D1Database;

      const engine = new DefaultAttendanceEngine(mockDb, mockEnv);

      // Candidate manual checkin -> success
      const candidateRes = await engine.recordManual({
        eventId: 'evt_pembekalan_2026',
        memberId: 'mem_candidate_1',
        sessionType: 'CHECKIN',
        stationId: null,
        operatorId: 'adm_1',
        reason: 'Manual candidate checkin',
      });
      expect(candidateRes.success).toBe(true);

      // Archived manual checkin -> reject
      const archivedRes = await engine.recordManual({
        eventId: 'evt_pembekalan_2026',
        memberId: 'mem_archived_1',
        sessionType: 'CHECKIN',
        stationId: null,
        operatorId: 'adm_1',
        reason: 'Manual archived checkin',
      });
      expect(archivedRes.success).toBe(false);
      expect(archivedRes.error?.code).toBe(ErrorCode.MEMBER_INACTIVE);
    });
  });

  // 4. AttendanceRepository Activity Stats with Status Filter
  describe('AttendanceRepository Activity Stats Filtering', () => {
    it('applies status filter when requested for candidates', async () => {
      let boundStatusParam: unknown = null;

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => {
            boundStatusParam = params[0];
            return {
              sql,
              params,
              all: async () => ({
                results: [
                  {
                    member_id: 'cand_1',
                    member_name: 'Calon 1',
                    member_external_id: 'CAND-001',
                    member_division: 'Web Dev',
                    member_group: 'Batch 2026',
                    status: 'candidate' as const,
                    total_events_attended: 2,
                    total_checkins: 2,
                    last_attended_at: '2026-03-01T10:00:00Z',
                  },
                ],
              }),
            };
          },
          first: async () => ({ total_events: 2 }),
        }),
      } as unknown as D1Database;

      const repo = new AttendanceRepository(mockDb);
      const res = await repo.getMemberActivityStats({ status: 'candidate' });

      expect(boundStatusParam).toBe('candidate');
      expect(res.entries.length).toBe(1);
      expect(res.entries[0].status).toBe('candidate');
      expect(res.entries[0].attendance_rate).toBe(100);
      expect(res.entries[0].activity_tier).toBe('highly_active');
    });
  });

  // 5. End-to-End API Routes & Role Authorization
  describe('Candidate API Endpoints & Role Authorization', () => {
    const adminUser = {
      id: 'adm_owner',
      email: 'admin@test.com',
      name: 'Super Admin',
      role: 'admin',
      status: 'active',
      member_id: null,
      created_at: '2026-01-01T00:00:00Z',
    };

    const operatorUser = {
      id: 'adm_op',
      email: 'operator@test.com',
      name: 'Field Operator',
      role: 'operator',
      status: 'active',
      member_id: null,
      created_at: '2026-01-01T00:00:00Z',
    };

    it('permits admin to induct candidates and logs audit', async () => {
      const adminToken = await createSessionToken(
        {
          email: adminUser.email,
          role: adminUser.role,
        },
        SESSION_SECRET
      );

      const mockCandidate: Member = {
        id: 'cand_1',
        external_id: 'CAND-001',
        name: 'Calon 1',
        email: null,
        phone: null,
        group_name: 'Batch 2026',
        division: null,
        status: 'candidate',
        metadata: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const mockDb = {
        prepare: (sql: string) => {
          const statement = {
            sql,
            params: [] as unknown[],
            bind: (...params: unknown[]) => ({
              sql,
              params,
              first: async () => {
                if (sql.includes('COUNT(*) as count FROM admins')) return { count: 1 };
                if (sql.includes('admins') && (sql.includes('email') || sql.includes('id = ?'))) return adminUser;
                return null;
              },
              all: async () => {
                if (sql.includes('members') && (sql.includes('id IN') || sql.includes('id = ?'))) {
                  return { results: [mockCandidate] };
                }
                return { results: [] };
              },
              run: async () => ({ success: true }),
            }),
            first: async () => {
              if (sql.includes('COUNT(*) as count FROM admins')) return { count: 1 };
              if (sql.includes('admins') && (sql.includes('email') || sql.includes('id = ?'))) return adminUser;
              return null;
            },
            all: async () => {
              if (sql.includes('members') && (sql.includes('id IN') || sql.includes('id = ?'))) {
                return { results: [mockCandidate] };
              }
              return { results: [] };
            },
            run: async () => ({ success: true }),
          };
          return statement;
        },
        batch: async () => [{ success: true }],
      } as unknown as D1Database;

      const req = new Request('http://localhost/api/members/candidates/induct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          member_ids: ['cand_1'],
          archive_remaining: false,
          division: 'Divisi Web',
        }),
      });

      const res = await app.request(req, {}, { ...mockEnv, DB: mockDb });
      expect(res.status).toBe(200);

      const json = (await res.json()) as ApiResponse<CandidateInductionResult>;
      expect(json.ok).toBe(true);
      expect(json.data?.promoted_count).toBe(1);
      expect(json.data?.promoted_ids).toEqual(['cand_1']);
    });

    it('rejects operator role with 403 Forbidden for candidate induction and purge', async () => {
      const operatorToken = await createSessionToken(
        {
          email: operatorUser.email,
          role: operatorUser.role,
        },
        SESSION_SECRET
      );

      const mockDb = {
        prepare: (sql: string) => {
          const statement = {
            sql,
            params: [] as unknown[],
            bind: (...params: unknown[]) => ({
              sql,
              params,
              first: async () => {
                if (sql.includes('COUNT(*) as count FROM admins')) return { count: 1 };
                if (sql.includes('admins') && (sql.includes('email') || sql.includes('id = ?'))) return operatorUser;
                return null;
              },
              all: async () => ({ results: [] }),
              run: async () => ({ success: true }),
            }),
            first: async () => {
              if (sql.includes('COUNT(*) as count FROM admins')) return { count: 1 };
              if (sql.includes('admins') && (sql.includes('email') || sql.includes('id = ?'))) return operatorUser;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          };
          return statement;
        },
        batch: async () => [{ success: true }],
      } as unknown as D1Database;

      // Induction attempt
      const inductReq = new Request('http://localhost/api/members/candidates/induct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`,
        },
        body: JSON.stringify({
          member_ids: ['cand_1'],
        }),
      });

      const inductRes = await app.request(inductReq, {}, { ...mockEnv, DB: mockDb });
      expect(inductRes.status).toBe(403);

      // Purge attempt
      const purgeReq = new Request('http://localhost/api/members/candidates/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${operatorToken}`,
        },
        body: JSON.stringify({
          all_archived: true,
        }),
      });

      const purgeRes = await app.request(purgeReq, {}, { ...mockEnv, DB: mockDb });
      expect(purgeRes.status).toBe(403);
    });
  });
});
