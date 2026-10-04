/**
 * One date vocabulary for the whole app.
 *
 * These call sites used to disagree: `EventList` rendered `dateStyle: 'medium'`
 * while `EventHeaderSummary` rendered a bare `toLocaleString('id-ID')`, so the
 * same event showed two different timestamps on two screens in the same app.
 * The ledger reads dates one way: `2 Mar 2026, 09.15`.
 */
const DATE_TIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TIME = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2 Mar 2026, 09.15`. `—` when the input is absent or unparseable. */
export function formatDateTime(iso?: string | null): string {
  const date = toDate(iso);
  return date ? DATE_TIME.format(date).replace(/\./g, '.') : '—';
}

/** `2 Mar 2026`. */
export function formatDate(iso?: string | null): string {
  const date = toDate(iso);
  return date ? DATE.format(date) : '—';
}

/** `09.15`. */
export function formatTime(iso?: string | null): string {
  const date = toDate(iso);
  return date ? TIME.format(date) : '—';
}

/**
 * A start/end pair as the ledger writes it: `2 Mar 2026, 09.15 — 4 Mar 2026,
 * 17.00`. An event with no end reads as `Fleksibel`, which is what
 * `EventHeaderSummary` already said, so the two now agree.
 */
export function formatRange(start?: string | null, end?: string | null): string {
  if (!toDate(start)) return end && toDate(end) ? `Sampai ${formatDate(end)}` : 'Belum dijadwalkan';
  const from = formatDateTime(start);
  if (!toDate(end)) return `${from} — Fleksibel`;
  return `${from} — ${formatDateTime(end)}`;
}