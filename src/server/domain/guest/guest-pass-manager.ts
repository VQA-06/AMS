import { ContentfulStatusCode } from 'hono/utils/http-status';
import { ErrorCode } from '@/shared/constants/error-codes';
import { generateQrToken } from '../../crypto/qr-crypto';
import { EventRepository } from '../../repositories/event.repo';
import { MemberRepository } from '../../repositories/member.repo';
import { QrTokenRepository } from '../../repositories/qr.repo';
import { EventGuestRepository } from '../../repositories/event-guest.repo';
import { AuditRepository } from '../../repositories/audit.repo';

export interface GuestInputItem {
  name: string;
  division?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface IssueGuestPassesCommand {
  eventId: string;
  guests?: GuestInputItem[];
  count?: number;
  prefix?: string;
  division?: string | null;
  expiresAt?: string | null;
  issuerId?: string | null;
}

export interface ImportPriorGuestsCommand {
  targetEventId: string;
  sourceEventId?: string | null;
  guestMemberIds: string[];
  issuerId?: string | null;
}

export interface GuestTokenItem {
  id: string;
  jti: string;
  member_id: string;
  member_name: string;
  member_external_id: string;
  member_division: string | null;
  qr_token: string;
  scope: 'event';
  expires_at: string;
}

export interface GuestPassBundle {
  total: number;
  tokens: GuestTokenItem[];
}

export interface GuestPassManagerResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    status_code: ContentfulStatusCode;
  };
}

export interface GuestPassManagerRepositories {
  eventRepo?: EventRepository;
  memberRepo?: MemberRepository;
  qrRepo?: QrTokenRepository;
  eventGuestRepo?: EventGuestRepository;
  auditRepo?: AuditRepository;
}

export interface GuestPassManager {
  issueGuestPasses(cmd: IssueGuestPassesCommand): Promise<GuestPassManagerResult<GuestPassBundle>>;
  importPriorGuests(cmd: ImportPriorGuestsCommand): Promise<GuestPassManagerResult<{ imported_count: number; message: string }>>;
}

export class DefaultGuestPassManager implements GuestPassManager {
  private eventRepo: EventRepository;
  private memberRepo: MemberRepository;
  private qrRepo: QrTokenRepository;
  private eventGuestRepo: EventGuestRepository;
  private auditRepo: AuditRepository;

  constructor(
    private db: D1Database,
    private env: Record<string, unknown>,
    repos?: GuestPassManagerRepositories
  ) {
    this.eventRepo = repos?.eventRepo ?? new EventRepository(this.db);
    this.memberRepo = repos?.memberRepo ?? new MemberRepository(this.db);
    this.qrRepo = repos?.qrRepo ?? new QrTokenRepository(this.db);
    this.eventGuestRepo = repos?.eventGuestRepo ?? new EventGuestRepository(this.db);
    this.auditRepo = repos?.auditRepo ?? new AuditRepository(this.db);
  }

  async issueGuestPasses(cmd: IssueGuestPassesCommand): Promise<GuestPassManagerResult<GuestPassBundle>> {
    const event = await this.eventRepo.findById(cmd.eventId);
    if (!event) {
      return {
        success: false,
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan / event tidak ditemukan.',
          status_code: 404,
        },
      };
    }

    const rawGuests = Array.isArray(cmd.guests) ? cmd.guests : [];
    const count = typeof cmd.count === 'number' ? cmd.count : 0;
    const prefix = cmd.prefix || 'Tamu Undangan';
    const division = cmd.division || null;

    const guestList: Array<{ name: string; division: string | null; email: string | null; phone: string | null }> = [];

    if (rawGuests.length > 0) {
      for (const g of rawGuests) {
        if (g.name && g.name.trim() !== '') {
          guestList.push({
            name: g.name.trim(),
            division: g.division?.trim() || division || 'Tamu Undangan',
            email: g.email?.trim() || null,
            phone: g.phone?.trim() || null,
          });
        }
      }
    } else if (count > 0) {
      const totalCount = Math.min(100, Math.max(1, count));
      for (let i = 1; i <= totalCount; i++) {
        const padNum = String(i).padStart(2, '0');
        guestList.push({
          name: `${prefix} #${padNum}`,
          division: division || 'Tamu Undangan',
          email: null,
          phone: null,
        });
      }
    }

    if (guestList.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Daftar nama atau jumlah tiket tamu tidak boleh kosong.',
          status_code: 400,
        },
      };
    }

    const kid = (this.env.QR_ACTIVE_KID as string) || 'k1';
    const issuer = (this.env.APP_ISSUER as string) || 'https://ams.ccunbaja.web.id';
    const audience = (this.env.APP_AUDIENCE as string) || 'ams';
    const validFrom = new Date().toISOString();
    const tokenExpiresAt =
      cmd.expiresAt ||
      (event.ends_at
        ? new Date(new Date(event.ends_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    const membersToInsert: Array<{
      id: string;
      external_id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      group_name?: string | null;
      division?: string | null;
      status?: 'active';
      metadata?: string;
    }> = [];

    const dbTokensToInsert: Array<{
      id: string;
      jti: string;
      member_id: string;
      event_id: string;
      scope: 'event';
      valid_from: string;
      expires_at: string;
      max_uses?: number | null;
      created_by?: string | null;
      note?: string | null;
    }> = [];

    const generatedTokens: GuestTokenItem[] = [];

    for (const guest of guestList) {
      const memberId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const guestExternalId = `GUEST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      membersToInsert.push({
        id: memberId,
        external_id: guestExternalId,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        group_name: `Tamu: ${event.name}`,
        division: guest.division,
        status: 'active',
        metadata: JSON.stringify({ temporary: true, event_id: event.id }),
      });

      const tokenId = `tok_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const jti = `jti_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

      const tokenString = await generateQrToken(
        {
          memberId,
          jti,
          scope: 'event',
          eventId: event.id,
          validFrom,
          expiresAt: tokenExpiresAt,
          issuer,
          audience,
          kid,
        },
        this.env
      );

      dbTokensToInsert.push({
        id: tokenId,
        jti,
        member_id: memberId,
        event_id: event.id,
        scope: 'event',
        valid_from: validFrom,
        expires_at: tokenExpiresAt,
        max_uses: 1,
        created_by: cmd.issuerId,
        note: `Guest Pass untuk ${event.name}`,
      });

      generatedTokens.push({
        id: tokenId,
        jti,
        member_id: memberId,
        member_name: guest.name,
        member_external_id: guestExternalId,
        member_division: guest.division || null,
        qr_token: tokenString,
        scope: 'event',
        expires_at: tokenExpiresAt,
      });
    }

    // Atomic batch inserts
    await this.memberRepo.createBatch(membersToInsert);
    await this.qrRepo.createBatch(dbTokensToInsert);

    // Register in event_guests for unified multi-event authorization and tracking
    await this.eventGuestRepo.importGuestsToEvent(
      event.id,
      membersToInsert.map((m) => m.id),
      event.id
    );

    await this.auditRepo.logAction({
      admin_id: cmd.issuerId,
      action: 'CREATE_EVENT_GUEST_PASSES',
      entity_type: 'event',
      entity_id: event.id,
      meta: {
        count: generatedTokens.length,
        event_name: event.name,
      },
    });

    return {
      success: true,
      data: {
        total: generatedTokens.length,
        tokens: generatedTokens,
      },
    };
  }

  async importPriorGuests(cmd: ImportPriorGuestsCommand): Promise<GuestPassManagerResult<{ imported_count: number; message: string }>> {
    const targetEvent = await this.eventRepo.findById(cmd.targetEventId);
    if (!targetEvent) {
      return {
        success: false,
        error: {
          code: ErrorCode.EVENT_NOT_FOUND,
          message: 'Kegiatan target tidak ditemukan.',
          status_code: 404,
        },
      };
    }

    const rawIds = Array.isArray(cmd.guestMemberIds) ? cmd.guestMemberIds : [];
    const guestMemberIds = rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

    if (guestMemberIds.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Pilih setidaknya satu peserta tamu untuk diimpor.',
          status_code: 400,
        },
      };
    }

    if (guestMemberIds.length > 200) {
      return {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Maksimal 200 peserta tamu per batch impor.',
          status_code: 400,
        },
      };
    }

    const targetExpiresAt = targetEvent.ends_at
      ? new Date(new Date(targetEvent.ends_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : targetEvent.starts_at && new Date(targetEvent.starts_at).getTime() > Date.now()
        ? new Date(new Date(targetEvent.starts_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const importedCount = await this.eventGuestRepo.importGuestsToEvent(
      cmd.targetEventId,
      guestMemberIds,
      cmd.sourceEventId || undefined,
      targetExpiresAt
    );

    await this.auditRepo.logAction({
      admin_id: cmd.issuerId,
      action: 'IMPORT_EVENT_GUESTS',
      entity_type: 'event',
      entity_id: cmd.targetEventId,
      meta: {
        imported_count: importedCount,
        source_event_id: cmd.sourceEventId,
        target_event_name: targetEvent.name,
      },
    });

    return {
      success: true,
      data: {
        imported_count: importedCount,
        message: `Berhasil mengimpor ${importedCount} tamu ke kegiatan ini.`,
      },
    };
  }
}
