import type { Member, Event } from '@/shared/types';

/**
 * The three boot-time reads that App fans out in parallel, and the rule for
 * deciding which of them actually failed.
 *
 * This exists as its own module so the honesty contract is directly testable.
 * The defect it replaces was `.catch(() => null)` per fetch: a rejected request
 * collapsed to `null`, the page rendered whatever it last held, and a total
 * outage looked identical to a legitimately empty roster. Naming the failures
 * is what stops a plausible zero from being read as a real count.
 */

/** Domain-vocabulary labels shown to the user in the failure banner. */
export const GLOBAL_SECTIONS = [
  { key: 'members', label: 'anggota', endpoint: '/api/members?limit=200' },
  { key: 'events', label: 'kegiatan', endpoint: '/api/agenda' },
  { key: 'divisions', label: 'divisi', endpoint: '/api/members/divisions' },
] as const;

export type GlobalSectionKey = (typeof GLOBAL_SECTIONS)[number]['key'];

export interface GlobalSectionResults {
  members: PromiseSettledResult<{ members: Member[]; total: number }>;
  events: PromiseSettledResult<{ events: Event[] }>;
  divisions: PromiseSettledResult<{ divisions: string[] }>;
}

/**
 * Returns the labels of the sections that rejected, in declaration order.
 *
 * A *fulfilled but empty* section is not a failure: an organisation with zero
 * events is a real, correct answer and must not raise an alarm. Only a
 * rejection counts, which is the distinction the old catch-all lost.
 */
export function failedGlobalSections(results: GlobalSectionResults): string[] {
  return GLOBAL_SECTIONS.filter(
    (section) => results[section.key].status === 'rejected'
  ).map((section) => section.label);
}

/**
 * The value to display for a section, or `undefined` when the section could
 * not be fetched. Returning `undefined` forces callers to keep their previous
 * value rather than overwriting it with an empty array that reads as "zero".
 */
export function sectionValue<T>(
  result: PromiseSettledResult<T>,
  select: (value: T) => unknown
): unknown | undefined {
  if (result.status !== 'fulfilled') return undefined;
  return select(result.value);
}