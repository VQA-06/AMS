import type { QrToken } from '@/shared/types';
import type { PrintableToken } from '../components/qr/PrintBadgeSheet';

/**
 * A token is printable only if it is live: not revoked, not past expiry, and
 * carrying a payload the scanner can actually read. A revoked or expired token
 * on a printed sheet is a ticket that bounces the attendee at the door, so it
 * must never reach paper.
 */
export function isPrintableToken(tok: QrToken, now: number = Date.now()): boolean {
  return (
    !tok.revoked_at &&
    new Date(tok.expires_at).getTime() > now &&
    Boolean(tok.qr_token)
  );
}

/**
 * Project live tokens onto the flat shape the print sheet renders. `eventName`
 * is stamped onto every row so a mixed-event sheet still names its event on
 * each badge. When `selectedIds` is given, the sheet honours the operator's
 * explicit selection instead of printing everything live — an empty set means
 * "nothing selected", which is deliberately different from `undefined`.
 */
export function filterPrintableTokens(
  tokens: QrToken[],
  eventName: string | null | undefined,
  selectedIds?: Set<string>,
  now: number = Date.now()
): PrintableToken[] {
  return tokens
    .filter((tok) => (selectedIds ? selectedIds.has(tok.id) : true))
    .filter((tok) => isPrintableToken(tok, now))
    .map((tok) => ({
      id: tok.id,
      member_id: tok.member_id,
      member_name: tok.member_name || 'Peserta',
      member_external_id: tok.member_external_id || tok.member_id,
      member_division: tok.member_division || null,
      qr_token: tok.qr_token || '',
      scope: tok.scope,
      expires_at: tok.expires_at,
      event_name: eventName ?? null,
    }));
}
