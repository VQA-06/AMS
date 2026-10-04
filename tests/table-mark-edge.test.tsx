import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TRow, TCell } from '../src/client/components/ui/Table';
import type { MarkTone } from '../src/client/components/ui/Table';

/**
 * A mark is a 2px edge on the leading cell, never a fill on the whole row.
 *
 * `Card` paints its mark as a `<span>` that takes a background class, so its
 * tone map would be `bg-*`. `TRow` cannot reuse it: a `<span>` is not a valid
 * child of `<tr>`, so the mark has to be a border on the first cell. Two
 * mistakes are guarded here, both of which produced a completely invisible
 * mark:
 *
 *  - reusing the `bg-*` map, which tints the entire row and washes out text;
 *  - reaching for a `[&>*…]` variant on the `<tr>`, which Tailwind compiles to
 *    `<class>>*:first-child` — a grandchild selector that cannot match a `<td>`.
 *
 * The border must therefore be applied to the cell element itself.
 */

const TONES: MarkTone[] = ['seal', 'pen', 'pending', 'danger', 'info', 'idle'];

/** The Tailwind hue each tone paints with, from `markToneClass`. */
const TONE_HUE: Record<MarkTone, string> = {
  seal: 'seal-500',
  pen: 'pen-500',
  pending: 'pending-500',
  danger: 'danger-500',
  info: 'info-500',
  idle: 'rule-strong',
};

/** The decoded class list of the first `<td>`/`<th>` in the rendered table. */
function cellClasses(html: string): string[] {
  // Match `<td`/`<th` only: `<table>` and `<tr` also start with `<t`.
  const start = html.search(/<t[dh]\b/);
  const classAt = html.indexOf('class="', start);
  if (classAt === -1) return [];
  const from = classAt + 'class="'.length;
  return html
    .slice(from, html.indexOf('"', from))
    .replace(/&amp;/g, '&') // React HTML-escapes the `&` in an arbitrary variant
    .split(/\s+/);
}

/** The decoded class list of the opening `<tr>` tag. */
function rowClasses(html: string): string[] {
  const tagStart = html.indexOf('<tr');
  const classAt = html.indexOf('class="', tagStart);
  if (classAt === -1) return [];
  const from = classAt + 'class="'.length;
  return html
    .slice(from, html.indexOf('"', from))
    .replace(/&amp;/g, '&')
    .split(/\s+/);
}

const rowHtml = (mark?: MarkTone): string =>
  renderToString(
    <table>
      <tbody>
        <TRow mark={mark}>
          <TCell>Rizky Ananta</TCell>
          <TCell>CHECKIN</TCell>
        </TRow>
      </tbody>
    </table>
  );

describe('TRow mark draws a leading edge, never a row fill', () => {
  it.each(TONES)('puts a 2px %s border on the leading cell', (tone) => {
    const list = cellClasses(rowHtml(tone));
    expect(list).toContain('border-l-2');
    expect(list).toContain(`border-l-${TONE_HUE[tone]}`);
  });

  it.each(TONES)('never paints the %s tone as a row background', (tone) => {
    // A fill on the <tr> would swallow the row and wash out its text.
    expect(rowClasses(rowHtml(tone))).not.toContain(`bg-${TONE_HUE[tone]}`);
  });

  it.each(TONES)('never uses a descendant variant to reach the cell from the row', (tone) => {
    // `[&>*…]` compiles to `<class>>*:first-child`, which cannot match a <td>.
    const anchored = [...rowClasses(rowHtml(tone)), ...cellClasses(rowHtml(tone))];
    expect(anchored.filter((c) => c.includes('>'))).toEqual([]);
  });

  it('leaves the remaining cells unmarked so only the leading edge is colored', () => {
    const html = renderToString(
      <table>
        <tbody>
          <TRow mark="seal">
            <TCell>Depan</TCell>
            <TCell className="text-right">Belakang</TCell>
          </TRow>
        </tbody>
      </table>
    );
    const cells = [...html.matchAll(/<td class="([^"]*)"/g)].map((m) => m[1]);
    expect(cells).toHaveLength(2);
    expect(cells[0]).toContain('border-l-2');
    expect(cells[1]).not.toContain('border-l-');
  });

  it('preserves the leading cell own classes when a mark is applied', () => {
    const html = renderToString(
      <table>
        <tbody>
          <TRow mark="danger">
            <TCell className="truncate font-mono">AMS-001</TCell>
          </TRow>
        </tbody>
      </table>
    );
    const list = cellClasses(html);
    expect(list).toContain('truncate');
    expect(list).toContain('font-mono');
    expect(list).toContain('border-l-2');
  });

  it('leaves a mark-less row and its cells completely unmarked', () => {
    const html = rowHtml(undefined);
    expect(html).not.toContain('data-mark');
    expect(cellClasses(html)).not.toContain('border-l-2');
    expect(rowClasses(html)).not.toContain('border-l-');
  });

  it('separates every row with a hairline rule, including the last', () => {
    const html = renderToString(
      <table>
        <tbody>
          <TRow>
            <TCell>Satu</TCell>
          </TRow>
        </tbody>
      </table>
    );
    // `divide-y` would skip the last row; a ledger without a closing rule is
    // not a ledger.
    const classes = rowClasses(html);
    expect(classes).toContain('border-b');
    expect(classes).toContain('border-rule');
    expect(classes).toContain('last:border-b-0');
    expect(html).not.toContain('divide-y');
  });

  it('keeps hover and selected state on the row, never as a mark hue', () => {
    const html = renderToString(
      <table>
        <tbody>
          <TRow mark="seal" onClick={() => {}} selected>
            <TCell>Terpilih</TCell>
          </TRow>
        </tbody>
      </table>
    );
    // `bg-paper-sunk` is a surface token, not a tone — it must not masquerade
    // as a mark hue.
    expect(rowClasses(html)).toContain('bg-paper-sunk');
    expect(rowClasses(html)).not.toContain('bg-seal-500');
  });
});