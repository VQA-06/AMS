import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Tabs, type TabItem } from '../src/client/components/ui/Tabs';

/**
 * The tab strip carries two invariants that are easy to regress and invisible
 * in types:
 *
 * 1. It scrolls without painting a scrollbar. `no-scrollbar` lives in
 *    `index.css`, so Tailwind emits no CSS if the utility is dropped from the
 *    strip's class list — the 5px pencil-grey band simply comes back under the
 *    labels on the surface users tap most.
 * 2. A tab renders its label and nothing else. `TabItem` has no `badge` field,
 *    so a call site cannot pass a count; the test asserts on the rendered HTML
 *    so a count reintroduced by any other route still fails.
 */
const items: TabItem[] = [
  { id: 'a', label: 'Daftar Hadir' },
  { id: 'b', label: 'Tiket QR Event' },
  { id: 'c', label: 'Kebijakan' },
];

describe('Tabs strip: scroll affordance and count de-duplication', () => {
  it('keeps the scroll container but hides its scrollbar', () => {
    const html = renderToString(
      <Tabs items={items} active="a" onChange={() => {}} ariaLabel="Navigasi tab" />
    );

    // The strip still scrolls — four settings labels do not fit a 344px box.
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('no-scrollbar');

    // The scroll cue that remains is the snap + clipped trailing tab, not a bar.
    expect(html).toContain('scroll-snap');
    expect(html).not.toContain('scroll-smooth-only');
  });

  it('renders each tab label and no count beside it', () => {
    const html = renderToString(
      <Tabs items={items} active="a" onChange={() => {}} ariaLabel="Navigasi tab" />
    );

    for (const item of items) {
      expect(html).toContain(item.label);
    }

    // `role="tab"` opens exactly three buttons; a badge would add a fourth
    // <span> inside one of them, so counting the spans pins the absence.
    const buttons = html.match(/role="tab"/g) ?? [];
    expect(buttons).toHaveLength(items.length);

    const tabMarkup = html.slice(html.indexOf('role="tab"'), html.lastIndexOf('role="tab"'));
    expect(tabMarkup).not.toMatch(/<span/);
  });
});
