import type { BadgeVariant } from '../components/ui/Badge';

/**
 * Single source of truth for event status color. Both the list
 * (components/events/EventList.tsx) and the detail header
 * (components/events/EventHeaderSummary.tsx) must render the same status in
 * the same hue, otherwise color encodes location instead of state.
 * `slate` is the catch-all so unknown/future statuses stay neutral.
 */
export function eventStatusVariant(status: string): BadgeVariant {
  if (status === 'active') return 'emerald';
  if (status === 'closed') return 'rose';
  return 'slate';
}
