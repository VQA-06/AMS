import { describe, it, expect, vi } from 'vitest';
import app from '../src/server/index';
import { createSessionToken } from '../src/server/crypto/session-crypto';
import { generateQrToken } from '../src/server/crypto/qr-crypto';
import { SessionType } from '../src/shared/types';

describe('End-to-End API Smoke Verification', () => {
  const TEST_BASE64_KEY = btoa('12345678901234567890123456789012');
  const SESSION_SECRET = 'super-secure-session-secret-key-32b!';

  const createMockDb = () => {
    const executedQueries: Array<{ sql: string; params: unknown[] }> = [];

    const mockAdmin = {
      id: 'adm_owner',
      email: 'owner@ams.cc',
      name: 'Owner Admin',
      role: 'owner',
      status: 'active',
      member_id: null,
      created_at: '2026-01-01T00:00:00Z',
    };

    const mockEvent = {
      id: 'evt_welcoming_2026',
      name: 'Welcoming Party 2026',
      status: 'active',
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-12-31T23:59:59Z',
      grace_minutes: 30,
      qr_policy: 'allow_both',
      allow_manual_attendance: 1,
      location: 'Grand Ballroom',
      created_at: '2026-01-01T00:00:00Z',
    };

    const mockMember = {
      id: 'mem_official_001',
      name: 'Budi Santoso',
      external_id: 'CC-001',
      email: 'budi@ams.cc',
      status: 'active',
      division: 'Web Dev',
      group_name: 'Group A',
      is_guest: 0,
      created_at: '2026-01-01T00:00:00Z',
    };

    const mockDb: Record<string, unknown> = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          sql,
          params,
          first: async <T>(): Promise<T | null> => {
            executedQueries.push({ sql, params });
            if (sql.includes('COUNT(*) as count FROM admins')) {
              return { count: 1 } as unknown as T;
            }
            if (sql.includes('admins') && (sql.includes('email') || sql.includes('a.email'))) {
              return mockAdmin as unknown as T;
            }
            if (sql.includes('events') && sql.includes('id = ?')) {
              return mockEvent as unknown as T;
            }
            if (sql.includes('qr_tokens') && sql.includes('jti = ?')) {
              return {
                id: 'tok_univ_001',
                jti: params[0],
                member_id: 'mem_official_001',
                scope: 'universal',
                max_uses: null,
                uses_count: 0,
                revoked_at: null,
                valid_from: '2026-01-01T00:00:00Z',
                expires_at: '2026-12-31T23:59:59Z',
              } as unknown as T;
            }
            if (sql.includes('members') && sql.includes('id = ?')) {
              return mockMember as unknown as T;
            }
            if (sql.includes('attendances') && sql.includes('session_type = ?')) {
              return null;
            }
            return null;
          },
          all: async <T>(): Promise<{ results: T[] }> => {
            executedQueries.push({ sql, params });
            return { results: [] };
          },
          run: async () => {
            executedQueries.push({ sql, params });
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
      batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
        for (const s of statements) {
          executedQueries.push(s);
        }
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    return mockDb as unknown as D1Database;
  };

  const getEnv = (mockDb: D1Database) => ({
    DB: mockDb,
    ENVIRONMENT: 'development',
    SESSION_SECRET,
    QR_ACTIVE_KID: 'k1',
    QR_KEY_K1: TEST_BASE64_KEY,
    APP_ISSUER: 'https://ams.ccunbaja.web.id',
    APP_AUDIENCE: 'ams',
  });

  it('POST /api/scan should scan and record valid attendance', async () => {
    const mockDb = createMockDb();
    const env = getEnv(mockDb);

    const sessionToken = await createSessionToken(
      { email: 'owner@ams.cc', role: 'owner' },
      SESSION_SECRET,
      3600
    );

    const validFrom = new Date(Date.now() - 60000);
    const expiresAt = new Date(Date.now() + 3600000);

    const qrToken = await generateQrToken(
      {
        memberId: 'mem_official_001',
        jti: 'jti_scan_001',
        scope: 'universal',
        validFrom,
        expiresAt,
        issuer: 'https://ams.ccunbaja.web.id',
        audience: 'ams',
        kid: 'k1',
      },
      env
    );

    const req = new Request('http://localhost/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        eventId: 'evt_welcoming_2026',
        qr: qrToken,
        sessionType: 'CHECKIN',
        stationId: 'gate_1',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; data: { attendance: { memberName: string; sessionType: string } } };
    expect(body.ok).toBe(true);
    expect(body.data.attendance.memberName).toBe('Budi Santoso');
    expect(body.data.attendance.sessionType).toBe('CHECKIN');
  });

  it('POST /api/agenda/:id/guests should generate guest passes in batch', async () => {
    const mockDb = createMockDb();
    const env = getEnv(mockDb);

    const sessionToken = await createSessionToken(
      { email: 'owner@ams.cc', role: 'owner' },
      SESSION_SECRET,
      3600
    );

    const req = new Request('http://localhost/api/agenda/evt_welcoming_2026/guests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        count: 2,
        prefix: 'Tamu Kehormatan',
        division: 'VIP',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; data: { total: number; tokens: Array<{ member_name: string }> } };
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(2);
    expect(body.data.tokens).toHaveLength(2);
    expect(body.data.tokens[0].member_name).toContain('Tamu Kehormatan');
  });

  it('POST /api/attendances/event/:id/manual should record manual attendance', async () => {
    const mockDb = createMockDb();
    const env = getEnv(mockDb);

    const sessionToken = await createSessionToken(
      { email: 'owner@ams.cc', role: 'owner' },
      SESSION_SECRET,
      3600
    );

    const req = new Request('http://localhost/api/attendances/event/evt_welcoming_2026/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        member_id: 'mem_official_001',
        session_type: 'CHECKIN',
        reason: 'Camera on tablet failed',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; data: { attendance: { isManual: boolean; memberName: string } } };
    expect(body.ok).toBe(true);
    expect(body.data.attendance.isManual).toBe(true);
    expect(body.data.attendance.memberName).toBe('Budi Santoso');
  });
});
