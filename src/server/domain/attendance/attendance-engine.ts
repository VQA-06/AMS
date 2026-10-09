import { SessionType } from '@/shared/types';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { ErrorCode } from '@/shared/constants/error-codes';
import { verifyQrToken } from '../../crypto/qr-crypto';
import { EventRepository } from '../../repositories/event.repo';
import { MemberRepository } from '../../repositories/member.repo';
import { QrTokenRepository } from '../../repositories/qr.repo';
import { AttendanceRepository } from '../../repositories/attendance.repo';
import { AuditRepository } from '../../repositories/audit.repo';
import { EventGuestRepository } from '../../repositories/event-guest.repo';

export interface ScanAttendanceCommand {
  eventId: string;
  qrToken: string;
  sessionType: SessionType;
  stationId: string | null;
  operatorId?: string | null;
}

export interface ManualAttendanceCommand {
  eventId: string;
  memberId: string;
  sessionType: SessionType;
  stationId: string | null;
  operatorId?: string | null;
  reason: string;
}

export interface AttendanceEngineResult {
  success: boolean;
  status: 'recorded' | 'rejected';
  attendance?: {
    id: string;
    memberName: string;
    memberExternalId: string;
    memberDivision: string | null;
    memberGroup?: string | null;
    eventName: string;
    sessionType: SessionType;
    isManual?: boolean;
    scannedAt: string;
  };
  participant?: {
    id: string;
    name: string;
    external_id: string;
    division: string | null;
    is_guest: boolean;
  };
  error?: {
    code: string;
    message: string;
    status_code: ContentfulStatusCode;
    details?: unknown;
  };
}

export interface AttendanceEngine {
  recordScan(cmd: ScanAttendanceCommand): Promise<AttendanceEngineResult>;
  recordManual(cmd: ManualAttendanceCommand): Promise<AttendanceEngineResult>;
}

/**
 * Guest participants carry no `is_guest` column; the codebase identifies them
 * by the GUEST- external_id prefix minted at promotion time, or a `Tamu:%`
 * group label. Mirrors the predicates used in member.repo / event.repo.
 */
export function isGuestMember(member: {
  external_id: string;
  group_name: string | null;
}): boolean {
  return (
    member.external_id.startsWith('GUEST-') ||
    (member.group_name?.startsWith('Tamu:') ?? false)
  );
}

export interface AttendanceEngineRepositories {
  eventRepo?: EventRepository;
  memberRepo?: MemberRepository;
  qrRepo?: QrTokenRepository;
  attendanceRepo?: AttendanceRepository;
  auditRepo?: AuditRepository;
  eventGuestRepo?: EventGuestRepository;
}

export class DefaultAttendanceEngine implements AttendanceEngine {
  private eventRepo: EventRepository;
  private memberRepo: MemberRepository;
  private qrRepo: QrTokenRepository;
  private attendanceRepo: AttendanceRepository;
  private auditRepo: AuditRepository;
  private eventGuestRepo: EventGuestRepository;

  constructor(
    private db: D1Database,
    private env: Record<string, unknown>,
    repos?: AttendanceEngineRepositories
  ) {
    this.eventRepo = repos?.eventRepo ?? new EventRepository(this.db);
    this.memberRepo = repos?.memberRepo ?? new MemberRepository(this.db);
    this.qrRepo = repos?.qrRepo ?? new QrTokenRepository(this.db);
    this.attendanceRepo = repos?.attendanceRepo ?? new AttendanceRepository(this.db);
    this.auditRepo = repos?.auditRepo ?? new AuditRepository(this.db);
    this.eventGuestRepo = repos?.eventGuestRepo ?? new EventGuestRepository(this.db);
  }

  async recordScan(cmd: ScanAttendanceCommand): Promise<AttendanceEngineResult> {
    // 1. Validate Event
    const event = await this.eventRepo.findById(cmd.eventId);
    if (!event) {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan / event tidak ditemukan.',
          status_code: 404,
        },
      };
    }

    if (event.status !== 'active') {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        reason: ErrorCode.EVENT_INACTIVE,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.EVENT_INACTIVE,
          message: `Event status "${event.status}" (belum aktif atau sudah ditutup).`,
          status_code: 400,
        },
      };
    }

    // Check time window with grace_minutes
    const now = new Date();
    const graceMs = (event.grace_minutes || 30) * 60 * 1000;

    if (event.starts_at) {
      const startsAt = new Date(event.starts_at);
      if (now.getTime() < startsAt.getTime() - graceMs) {
        await this.auditRepo.recordFailedScan({
          eventId: cmd.eventId,
          reason: ErrorCode.EVENT_NOT_STARTED,
          stationId: cmd.stationId,
          operatorId: cmd.operatorId,
        });
        return {
          success: false,
          status: 'rejected',
          error: {
            code: ErrorCode.EVENT_NOT_STARTED,
            message: 'Waktu kegiatan belum dimulai.',
            status_code: 400,
          },
        };
      }
    }

    if (event.ends_at) {
      const endsAt = new Date(event.ends_at);
      if (now.getTime() > endsAt.getTime() + graceMs) {
        await this.auditRepo.recordFailedScan({
          eventId: cmd.eventId,
          reason: ErrorCode.EVENT_ENDED,
          stationId: cmd.stationId,
          operatorId: cmd.operatorId,
        });
        return {
          success: false,
          status: 'rejected',
          error: {
            code: ErrorCode.EVENT_ENDED,
            message: 'Waktu kegiatan telah berakhir.',
            status_code: 400,
          },
        };
      }
    }

    // Validate session_modes
    let allowedModes: string[] = ['checkin'];
    if (event.session_modes) {
      try {
        const parsed = typeof event.session_modes === 'string' ? JSON.parse(event.session_modes) : event.session_modes;
        if (Array.isArray(parsed) && parsed.length > 0) {
          allowedModes = parsed.map((m: unknown) => String(m).toLowerCase());
        }
      } catch {
        allowedModes = [String(event.session_modes).toLowerCase()];
      }
    }

    const reqMode = String(cmd.sessionType || '').toLowerCase();
    if (!allowedModes.includes(reqMode)) {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        reason: ErrorCode.VALIDATION_ERROR,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Sesi presensi "${cmd.sessionType}" tidak diaktifkan pada kegiatan ini.`,
          status_code: 400,
        },
      };
    }

    // 2. Decrypt and verify QR JWE token
    let decrypted;
    try {
      const trustedIssuers = this.env.TRUSTED_ISSUERS
        ? String(this.env.TRUSTED_ISSUERS)
            .split(',')
            .map((s) => s.trim())
        : [
            (this.env.APP_ISSUER as string) || 'https://ams.ccunbaja.web.id',
            'https://ams.ccunbaja.web.id',
            'https://ams.humanone.workers.dev',
            'https://absen.local',
          ];

      decrypted = await verifyQrToken(cmd.qrToken, {
        expectedIssuer: trustedIssuers,
        expectedAudience: (this.env.APP_AUDIENCE as string) || 'ams',
        env: this.env,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : ErrorCode.TOKEN_INVALID;
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        reason: errMsg,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: errMsg,
          message:
            errMsg === ErrorCode.TOKEN_EXPIRED
              ? 'QR Code sudah kedaluwarsa.'
              : errMsg === ErrorCode.TOKEN_NOT_ACTIVE_YET
              ? 'QR Code belum masuk masa aktif.'
              : 'QR Code tidak valid atau rusak.',
          status_code: 400,
        },
      };
    }

    // 3. Check QR Token in database
    const dbToken = await this.qrRepo.findByJti(decrypted.jti);
    if (!dbToken) {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.TOKEN_INVALID,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.TOKEN_INVALID,
          message: 'QR Token tidak terdaftar di sistem.',
          status_code: 400,
        },
      };
    }

    if (dbToken.revoked_at) {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.TOKEN_REVOKED,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.TOKEN_REVOKED,
          message: 'QR Code telah dicabut / dinonaktifkan oleh admin.',
          status_code: 400,
        },
      };
    }

    // For imported multi-event guests, token may have been used at the source event (uses_count >= 1).
    // Duplicate check per event is enforced strictly by attendanceRepo.findByEventMemberSession below.
    const isMultiEventGuest = decrypted.scope === 'event' && decrypted.eventId !== cmd.eventId;

    if (!isMultiEventGuest && dbToken.max_uses !== null && dbToken.uses_count >= dbToken.max_uses) {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.MAX_USES_EXCEEDED,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.MAX_USES_EXCEEDED,
          message: 'Batas pemakaian QR Code ini telah habis.',
          status_code: 400,
        },
      };
    }

    // 4. Check Member Status
    const member = await this.memberRepo.findById(decrypted.memberId);
    if (!member) {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.MEMBER_NOT_FOUND,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.MEMBER_NOT_FOUND,
          message: 'Data anggota tidak ditemukan.',
          status_code: 404,
        },
      };
    }

    if (member.status !== 'active' && member.status !== 'candidate') {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.MEMBER_INACTIVE,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.MEMBER_INACTIVE,
          message: 'Status anggota nonaktif atau telah diarsipkan.',
          status_code: 400,
        },
      };
    }

    // 5. Scope & QR Policy Validation
    if (event.qr_policy === 'event_only' && decrypted.scope === 'universal') {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        tokenJti: decrypted.jti,
        memberId: decrypted.memberId,
        reason: ErrorCode.UNIVERSAL_NOT_ALLOWED,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.UNIVERSAL_NOT_ALLOWED,
          message: 'Kegiatan ini hanya menerima QR khusus event (QR Universal ditolak).',
          status_code: 400,
        },
      };
    }

    if (decrypted.scope === 'event' && decrypted.eventId !== cmd.eventId) {
      // Converted candidates / official active members are permitted across events when universal attendance is allowed
      const isMemberCrossEventAllowed =
        !isGuestMember(member) &&
        (member.status === 'candidate' || member.status === 'active') &&
        event.qr_policy !== 'event_only';
      const isAuthorized =
        isMemberCrossEventAllowed ||
        (await this.eventGuestRepo.isGuestAuthorizedForEvent(cmd.eventId, decrypted.memberId));

      if (!isAuthorized) {
        await this.auditRepo.recordFailedScan({
          eventId: cmd.eventId,
          tokenJti: decrypted.jti,
          memberId: decrypted.memberId,
          reason: ErrorCode.WRONG_EVENT,
          stationId: cmd.stationId,
          operatorId: cmd.operatorId,
        });
        return {
          success: false,
          status: 'rejected',
          error: {
            code: ErrorCode.WRONG_EVENT,
            message: 'QR Code ini ditujukan untuk kegiatan yang berbeda.',
            status_code: 400,
          },
        };
      }
    }

    // 6. Check Duplicate Attendance
    const existingAttendance = await this.attendanceRepo.findByEventMemberSession(
      cmd.eventId,
      member.id,
      cmd.sessionType
    );

    if (existingAttendance) {
      await this.auditRepo.recordFailedScan({
        eventId: cmd.eventId,
        tokenJti: decrypted.jti,
        memberId: member.id,
        reason: ErrorCode.ALREADY_SCANNED,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
      });
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.ALREADY_SCANNED,
          message: `Anggota sudah melakukan absensi ${cmd.sessionType} sebelumnya.`,
          status_code: 400,
        },
      };
    }

    // 7. Atomic Insert Attendance & Update Token & Record Success
    const attendanceId = `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const scannedAt = new Date().toISOString();

    try {
      await this.attendanceRepo.recordScanAtomic({
        attendanceId,
        eventId: cmd.eventId,
        memberId: member.id,
        qrTokenId: dbToken.id,
        sessionType: cmd.sessionType,
        stationId: cmd.stationId,
        operatorId: cmd.operatorId,
        tokenJti: decrypted.jti,
      });
    } catch (err: unknown) {
      console.error('Atomic scan batch error in AttendanceEngine:', err);
      const isDuplicate =
        err instanceof Error &&
        (err.message.includes('UNIQUE') ||
          err.message.includes('ux_attendance_unique') ||
          err.message.toLowerCase().includes('already scanned'));

      return {
        success: false,
        status: 'rejected',
        error: {
          code: isDuplicate ? ErrorCode.ALREADY_SCANNED : ErrorCode.INTERNAL_ERROR,
          message: isDuplicate
            ? `Anggota sudah melakukan absensi ${cmd.sessionType} sebelumnya.`
            : `Gagal mencatat presensi: ${err instanceof Error ? err.message : 'Kesalahan sistem database.'}`,
          status_code: 400,
        },
      };
    }

    return {
      success: true,
      status: 'recorded',
      attendance: {
        id: attendanceId,
        memberName: member.name,
        memberExternalId: member.external_id,
        memberDivision: member.division,
        memberGroup: member.group_name,
        eventName: event.name,
        sessionType: cmd.sessionType,
        scannedAt,
      },
      participant: {
        id: member.id,
        name: member.name,
        external_id: member.external_id,
        division: member.division,
        is_guest: isGuestMember(member),
      },
    };
  }

  async recordManual(cmd: ManualAttendanceCommand): Promise<AttendanceEngineResult> {
    const event = await this.eventRepo.findById(cmd.eventId);
    if (!event) {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan / event tidak ditemukan.',
          status_code: 404,
        },
      };
    }

    if (event.status !== 'active') {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.EVENT_INACTIVE,
          message: `Event status "${event.status}" (belum aktif atau sudah ditutup).`,
          status_code: 400,
        },
      };
    }
    if (!event.allow_manual_attendance) {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Pencatatan presensi manual dinonaktifkan pada kegiatan ini.',
          status_code: 400,
        },
      };
    }

    // Validate session_modes
    let allowedManualModes: string[] = ['checkin'];
    if (event.session_modes) {
      try {
        const parsed = typeof event.session_modes === 'string' ? JSON.parse(event.session_modes) : event.session_modes;
        if (Array.isArray(parsed) && parsed.length > 0) {
          allowedManualModes = parsed.map((m: unknown) => String(m).toLowerCase());
        }
      } catch {
        allowedManualModes = [String(event.session_modes).toLowerCase()];
      }
    }

    const reqManualMode = String(cmd.sessionType || '').toLowerCase();
    if (!allowedManualModes.includes(reqManualMode)) {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Sesi presensi "${cmd.sessionType}" tidak diaktifkan pada kegiatan ini.`,
          status_code: 400,
        },
      };
    }

    const member = await this.memberRepo.findById(cmd.memberId);
    if (!member) {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.MEMBER_NOT_FOUND,
          message: 'Anggota tidak ditemukan.',
          status_code: 404,
        },
      };
    }

    if (member.status !== 'active' && member.status !== 'candidate') {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.MEMBER_INACTIVE,
          message: 'Status anggota nonaktif atau telah diarsipkan.',
          status_code: 400,
        },
      };
    }
    // Check duplicate
    const existing = await this.attendanceRepo.findByEventMemberSession(cmd.eventId, member.id, cmd.sessionType);
    if (existing) {
      return {
        success: false,
        status: 'rejected',
        error: {
          code: ErrorCode.ALREADY_SCANNED,
          message: `Anggota sudah tercatat hadir untuk sesi ${cmd.sessionType}.`,
          status_code: 400,
        },
      };
    }

    const attendanceId = `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const scannedAt = new Date().toISOString();

    await this.attendanceRepo.recordManual({
      attendanceId,
      eventId: cmd.eventId,
      memberId: member.id,
      sessionType: cmd.sessionType,
      operatorId: cmd.operatorId,
      stationId: cmd.stationId,
      reason: cmd.reason,
    });

    await this.auditRepo.logAction({
      admin_id: cmd.operatorId,
      action: 'RECORD_MANUAL_ATTENDANCE',
      entity_type: 'attendance',
      entity_id: attendanceId,
      meta: {
        event_id: cmd.eventId,
        event_name: event.name,
        member_id: member.id,
        member_name: member.name,
        session_type: cmd.sessionType,
        notes: cmd.reason,
      },
    });

    return {
      success: true,
      status: 'recorded',
      attendance: {
        id: attendanceId,
        memberName: member.name,
        memberExternalId: member.external_id,
        memberDivision: member.division,
        eventName: event.name,
        sessionType: cmd.sessionType,
        isManual: true,
        scannedAt,
      },
      participant: {
        id: member.id,
        name: member.name,
        external_id: member.external_id,
        division: member.division,
        is_guest: isGuestMember(member),
      },
    };
  }
}
