import type { BadgeVariant } from '../components/ui/Badge';
import type { MarkTone } from '../components/ui/Table';

/**
 * Single source of truth for event status color. Both the list
 * (components/events/EventList.tsx) and the detail header
 * (components/events/EventHeaderSummary.tsx) must render the same status in
 * the same hue, otherwise color encodes location instead of state.
 *
 * `active` is live (seal), `closed` is terminal (pen), `draft` is pending work
 * (pending). `archived` and any future status falls through to `neutral`, so a
 * status this build does not know stays visually quiet rather than alarming.
 */
export function eventStatusVariant(status: string): BadgeVariant {
  if (status === 'active') return 'seal';
  if (status === 'draft') return 'pending';
  if (status === 'closed') return 'danger';
  return 'neutral';
}

/** Indonesian display word for a status. The word is the message; hue is support. */
export function eventStatusLabel(status: string): string {
  if (status === 'active') return 'Aktif';
  if (status === 'draft') return 'Draf';
  if (status === 'closed') return 'Selesai';
  if (status === 'archived') return 'Arsip';
  return status;
}

export function eventStatusMark(status: string): MarkTone {
  const variant = eventStatusVariant(status);
  if (variant === 'seal') return 'seal';
  if (variant === 'pending') return 'pending';
  if (variant === 'danger') return 'danger';
  return 'idle';
}

/**
 * Session-type color, from the shared domain vocabulary. Check-in and
 * check-out are the two real attendance states and get the two state hues;
 * breaks are interruptions and stay neutral (info / neutral) so neither break
 * reads as present or absent. Used by the roster table, the guest-pass table,
 * and the detail page — three call sites that must agree.
 */
export function sessionTypeVariant(sessionType: string): BadgeVariant {
  if (sessionType === 'CHECKIN') return 'seal';
  if (sessionType === 'CHECKOUT') return 'pen';
  if (sessionType === 'BREAK_OUT') return 'info';
  return 'neutral';
}

/**
 * The same mapping expressed as a mark tone for surfaces where the leading
 * stroke replaces the status badge. A break-out takes `info` so it stays
 * visibly distinct from a break-in — the two are different movements of the
 * same person, and an operator must be able to see which way the row went
 * without reading the word. Neither break takes a state mark: an interruption
 * is not a presence or an absence.
 */
export function sessionTypeMark(sessionType: string): MarkTone {
  const variant = sessionTypeVariant(sessionType);
  if (variant === 'seal') return 'seal';
  if (variant === 'pen') return 'pen';
  if (variant === 'info') return 'info';
  return 'idle';
}