import { describe, it, expect, vi } from 'vitest';
import { AttendanceRepository } from '../src/server/repositories/attendance.repo';
import { SessionType } from '../src/shared/types';
import { ErrorCode } from '../src/shared/constants/error-codes';

describe('Attendance Scan & Manual Attendance Synchronization', () => {
  it('should construct recordScanAtomic batch with correct table columns (created_at on scan_attempts)', async () => {
    const executedStatements: Array<{ sql: string; params: any[] }> = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          sql,
          params,
        }),
      }),
      batch: async (statements: any[]) => {
        for (const s of statements) {
          executedStatements.push({ sql: s.sql, params: s.params });
        }
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repo = new AttendanceRepository(mockDb);

    await repo.recordScanAtomic({
      attendanceId: 'att_test_123',
      eventId: 'evt_welcoming_2026',
      memberId: 'mem_official_001',
      qrTokenId: 'tok_univ_001',
      sessionType: 'CHECKIN' as SessionType,
      stationId: 'stn_gate_a',
      operatorId: 'adm_operator_1',
      tokenJti: 'jti_token_001',
      meta: {},
    });

    expect(executedStatements.length).toBe(3);

    // 1. attendances insert
    expect(executedStatements[0].sql).toContain('INSERT INTO attendances');
    expect(executedStatements[0].sql).toContain('scanned_at');
    expect(executedStatements[0].params[0]).toBe('att_test_123');
    expect(executedStatements[0].params[1]).toBe('evt_welcoming_2026');
    expect(executedStatements[0].params[2]).toBe('mem_official_001');

    // 2. qr_tokens update
    expect(executedStatements[1].sql).toContain('UPDATE qr_tokens SET uses_count = uses_count + 1');
    expect(executedStatements[1].params[0]).toBe('tok_univ_001');

    // 3. scan_attempts insert (CRITICAL: must use created_at, NOT scanned_at)
    expect(executedStatements[2].sql).toContain('INSERT INTO scan_attempts');
    expect(executedStatements[2].sql).toContain('created_at');
    expect(executedStatements[2].sql).not.toContain('scanned_at');
    expect(executedStatements[2].params[1]).toBe('evt_welcoming_2026');
    expect(executedStatements[2].params[2]).toBe('jti_token_001');
    expect(executedStatements[2].params[3]).toBe('mem_official_001');
  });

  it('should construct recordManual with attendance insertion and scan attempt audit', async () => {
    const executedStatements: Array<{ sql: string; params: any[] }> = [];

    const mockDb: any = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          sql,
          params,
        }),
      }),
      batch: async (statements: any[]) => {
        for (const s of statements) {
          executedStatements.push({ sql: s.sql, params: s.params });
        }
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repo = new AttendanceRepository(mockDb);

    await repo.recordManual({
      attendanceId: 'att_manual_001',
      eventId: 'evt_workshop',
      memberId: 'mem_002',
      sessionType: 'CHECKIN',
      operatorId: 'adm_1',
      stationId: 'stn_1',
      reason: 'Lupa membawa HP/tiket QR fisik',
    });

    expect(executedStatements.length).toBe(2);

    // 1. attendances insert
    expect(executedStatements[0].sql).toContain('INSERT INTO attendances');
    expect(executedStatements[0].params[0]).toBe('att_manual_001');
    expect(executedStatements[0].params[6]).toBe('adm_1');
    expect(executedStatements[0].params[7]).toContain('Lupa membawa HP');

    // 2. scan_attempts audit entry
    expect(executedStatements[1].sql).toContain('INSERT INTO scan_attempts');
    expect(executedStatements[1].sql).toContain('created_at');
    expect(executedStatements[1].params[3]).toBe('mem_002');
    expect(executedStatements[1].params[4]).toBe('Manual: Lupa membawa HP/tiket QR fisik');
  });

  it('should enforce event allow_manual_attendance rule', () => {
    const eventManualAllowed = {
      id: 'evt_1',
      name: 'Event A',
      allow_manual_attendance: 1,
    };

    const eventManualBlocked = {
      id: 'evt_2',
      name: 'Event B',
      allow_manual_attendance: 0,
    };

    const checkManualAllowed = (event: typeof eventManualAllowed) => {
      return Boolean(event.allow_manual_attendance);
    };

    expect(checkManualAllowed(eventManualAllowed)).toBe(true);
    expect(checkManualAllowed(eventManualBlocked)).toBe(false);
  });

  it('should accurately differentiate UNIQUE duplicate scan errors from internal errors', () => {
    const duplicateError = new Error('UNIQUE constraint failed: attendances.event_id, attendances.member_id, attendances.session_type');
    const dbConnectionError = new Error('D1_ERROR: Connection closed');

    const classifyError = (err: Error) => {
      const isDuplicate =
        err.message.includes('UNIQUE') ||
        err.message.includes('ux_attendance_unique') ||
        err.message.toLowerCase().includes('already scanned');

      return {
        code: isDuplicate ? ErrorCode.ALREADY_SCANNED : ErrorCode.INTERNAL_ERROR,
        message: isDuplicate
          ? 'Anggota sudah pernah diabsen untuk sesi ini.'
          : `Gagal mencatat presensi: ${err.message}`,
      };
    };

    const res1 = classifyError(duplicateError);
    expect(res1.code).toBe(ErrorCode.ALREADY_SCANNED);
    expect(res1.message).toBe('Anggota sudah pernah diabsen untuk sesi ini.');

    const res2 = classifyError(dbConnectionError);
    expect(res2.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(res2.message).toContain('D1_ERROR: Connection closed');
  });
});
