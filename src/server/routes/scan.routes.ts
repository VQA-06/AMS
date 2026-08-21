import { Hono } from 'hono';
import { Env } from '../env';
import { MemberRepository } from '../repositories/member.repo';
import { EventRepository } from '../repositories/event.repo';
import { QrTokenRepository } from '../repositories/qr.repo';
import { AttendanceRepository } from '../repositories/attendance.repo';
import { AuditRepository } from '../repositories/audit.repo';
import { authMiddleware, requireRole } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limit';
import { scanRequestSchema } from '@/shared/schemas/scan.schema';
import { verifyQrToken } from '../crypto/qr-crypto';
import { ApiResponse } from '@/shared/types';
import { ErrorCode } from '@/shared/constants/error-codes';

const scanRoutes = new Hono<{ Bindings: Env }>();

// POST /api/scan - Scan and validate attendance
scanRoutes.post(
  '/',
  authMiddleware,
  requireRole(['owner', 'admin', 'operator']),
  createRateLimiter({ maxRequests: 60, windowSeconds: 60, keyPrefix: 'scan' }),
  async (c) => {
    const body = await c.req.json();
    const input = scanRequestSchema.parse(body);

    const admin = c.get('admin');
    const eventRepo = new EventRepository(c.env.DB);
    const memberRepo = new MemberRepository(c.env.DB);
    const qrRepo = new QrTokenRepository(c.env.DB);
    const attendanceRepo = new AttendanceRepository(c.env.DB);
    const auditRepo = new AuditRepository(c.env.DB);

    // 1. Validate Event
    const event = await eventRepo.findById(input.eventId);
    if (!event) {
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.EVENT_NOT_FOUND,
            message: 'Kegiatan / event tidak ditemukan.',
          },
        },
        404
      );
    }

    if (event.status !== 'active') {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        reason: ErrorCode.EVENT_INACTIVE,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.EVENT_INACTIVE,
            message: `Event status "${event.status}" (belum aktif atau sudah ditutup).`,
          },
        },
        400
      );
    }

    // Check time window with grace_minutes
    const now = new Date();
    const graceMs = (event.grace_minutes || 30) * 60 * 1000;

    if (event.starts_at) {
      const startsAt = new Date(event.starts_at);
      if (now.getTime() < startsAt.getTime() - graceMs) {
        await auditRepo.recordFailedScan({
          eventId: input.eventId,
          reason: ErrorCode.EVENT_NOT_STARTED,
          stationId: input.stationId,
          operatorId: admin?.id,
        });
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.EVENT_NOT_STARTED,
              message: 'Waktu kegiatan belum dimulai.',
            },
          },
          400
        );
      }
    }

    if (event.ends_at) {
      const endsAt = new Date(event.ends_at);
      if (now.getTime() > endsAt.getTime() + graceMs) {
        await auditRepo.recordFailedScan({
          eventId: input.eventId,
          reason: ErrorCode.EVENT_ENDED,
          stationId: input.stationId,
          operatorId: admin?.id,
        });
        return c.json<ApiResponse>(
          {
            ok: false,
            error: {
              code: ErrorCode.EVENT_ENDED,
              message: 'Waktu kegiatan telah berakhir.',
            },
          },
          400
        );
      }
    }

    // 2. Decrypt and verify QR JWE token
    let decrypted;
    try {
      decrypted = await verifyQrToken(input.qr, {
        expectedIssuer: c.env.APP_ISSUER || 'https://absen.local',
        expectedAudience: c.env.APP_AUDIENCE || 'ams',
        env: c.env,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : ErrorCode.TOKEN_INVALID;
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        reason: errMsg,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: errMsg,
            message:
              errMsg === ErrorCode.TOKEN_EXPIRED
                ? 'QR Code sudah kedaluwarsa.'
                : errMsg === ErrorCode.TOKEN_NOT_ACTIVE_YET
                ? 'QR Code belum masuk masa aktif.'
                : 'QR Code tidak valid atau rusak.',
          },
        },
        400
      );
    }

    // 3. Check QR Token in database
    const dbToken = await qrRepo.findByJti(decrypted.jti);
    if (!dbToken) {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.TOKEN_INVALID,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.TOKEN_INVALID,
            message: 'QR Token tidak terdaftar di sistem.',
          },
        },
        400
      );
    }

    if (dbToken.revoked_at) {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.TOKEN_REVOKED,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.TOKEN_REVOKED,
            message: 'QR Code telah dicabut / dinonaktifkan oleh admin.',
          },
        },
        400
      );
    }

    if (dbToken.max_uses !== null && dbToken.uses_count >= dbToken.max_uses) {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.MAX_USES_EXCEEDED,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.MAX_USES_EXCEEDED,
            message: 'Batas pemakaian QR Code ini telah habis.',
          },
        },
        400
      );
    }

    // 4. Check Member Status
    const member = await memberRepo.findById(decrypted.memberId);
    if (!member) {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.MEMBER_NOT_FOUND,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.MEMBER_NOT_FOUND,
            message: 'Data anggota tidak ditemukan.',
          },
        },
        404
      );
    }

    if (member.status !== 'active') {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.MEMBER_INACTIVE,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.MEMBER_INACTIVE,
            message: 'Status anggota nonaktif.',
          },
        },
        400
      );
    }

    // 5. Scope & QR Policy Validation
    if (event.qr_policy === 'event_only' && decrypted.scope === 'universal') {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.UNIVERSAL_NOT_ALLOWED,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.UNIVERSAL_NOT_ALLOWED,
            message: 'Kegiatan ini hanya menerima QR khusus event (QR Universal ditolak).',
          },
        },
        400
      );
    }

    if (decrypted.scope === 'event' && decrypted.eventId !== input.eventId) {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.WRONG_EVENT,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.WRONG_EVENT,
            message: 'QR Code ini ditujukan untuk kegiatan yang berbeda.',
          },
        },
        400
      );
    }

    // 6. Check Duplicate Attendance
    const existingAttendance = await attendanceRepo.findByEventMemberSession(
      input.eventId,
      member.id,
      input.sessionType
    );

    if (existingAttendance) {
      await auditRepo.recordFailedScan({
        eventId: input.eventId,
        tokenJti: decrypted.jti,
        memberId: member.id,
        reason: ErrorCode.ALREADY_SCANNED,
        stationId: input.stationId,
        operatorId: admin?.id,
      });
      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: ErrorCode.ALREADY_SCANNED,
            message: `Anggota sudah melakukan absensi ${input.sessionType} sebelumnya.`,
          },
        },
        400
      );
    }

    // 7. Atomic Insert Attendance & Update Token & Record Success
    const attendanceId = `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const scannedAt = new Date().toISOString();

    try {
      await attendanceRepo.recordScanAtomic({
        attendanceId,
        eventId: input.eventId,
        memberId: member.id,
        qrTokenId: dbToken.id,
        sessionType: input.sessionType,
        stationId: input.stationId,
        operatorId: admin?.id,
        tokenJti: decrypted.jti,
      });
    } catch (err: unknown) {
      console.error('Atomic scan batch error:', err);
      const isDuplicate =
        err instanceof Error &&
        (err.message.includes('UNIQUE') ||
          err.message.includes('ux_attendance_unique') ||
          err.message.toLowerCase().includes('already scanned'));

      return c.json<ApiResponse>(
        {
          ok: false,
          error: {
            code: isDuplicate ? ErrorCode.ALREADY_SCANNED : ErrorCode.INTERNAL_ERROR,
            message: isDuplicate
              ? `Anggota sudah melakukan absensi ${input.sessionType} sebelumnya.`
              : `Gagal mencatat presensi: ${err instanceof Error ? err.message : 'Kesalahan sistem database.'}`,
          },
        },
        400
      );
    }

    return c.json<ApiResponse>({
      ok: true,
      data: {
        attendance: {
          id: attendanceId,
          memberName: member.name,
          memberExternalId: member.external_id,
          memberDivision: member.division, // Display division on scan response
          memberGroup: member.group_name,
          eventName: event.name,
          sessionType: input.sessionType,
          scannedAt,
        },
      },
    });
  }
);

export { scanRoutes };
