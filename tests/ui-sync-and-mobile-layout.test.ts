import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  mobileNavItems,
  desktopNavGroups,
  tabLabelFor,
} from '../src/client/components/layout/MobileShell';
import { sessionTypeVariant, eventStatusVariant } from '../src/client/lib/event-status';

describe('Mobile Shell Navigation', () => {
  it('gives the mobile dock exactly 5 items with Scanner centred at index 2', () => {
    expect(mobileNavItems).toHaveLength(5);
    expect(mobileNavItems[2].key).toBe('scanner');
    expect(mobileNavItems[2].isScanner).toBe(true);
  });

  it('keeps the dock balanced around the Scanner — two items on each side', () => {
    expect(mobileNavItems.slice(0, 2).map((i) => i.key)).toEqual(['dashboard', 'members']);
    expect(mobileNavItems.slice(3).map((i) => i.key)).toEqual(['events', 'tracker']);
  });

  it('marks Scanner as the only promoted dock item', () => {
    expect(mobileNavItems.filter((i) => i.isScanner).map((i) => i.key)).toEqual(['scanner']);
  });

  it('exposes every operator-reachable screen in the desktop sidebar, settings included', () => {
    const keys = desktopNavGroups.flatMap((g) => g.items.map((i) => i.key));
    expect(keys).toHaveLength(6);
    expect(keys).toContain('settings');
    expect(new Set(keys).size).toBe(6);
  });

  it('gives every sidebar and dock entry a non-empty label for screen readers', () => {
    const all = [...desktopNavGroups.flatMap((g) => g.items), ...mobileNavItems];
    for (const item of all) {
      expect(item.label.trim(), `${item.key} needs a label`).not.toBe('');
    }
  });

  it('labels every route tab, including the error and offline routes', () => {
    for (const key of [
      'dashboard',
      'members',
      'events',
      'tracker',
      'scanner',
      'settings',
      '404',
      '403',
      'offline',
    ] as const) {
      expect(tabLabelFor(key), `${key} needs a breadcrumb label`).not.toBe(key);
    }
  });
});

describe('Shared colour semantics', () => {
  it('keeps the warning hue out of every attendance session type', () => {
    for (const type of ['CHECKIN', 'CHECKOUT', 'BREAK_OUT', 'BREAK_IN']) {
      expect(sessionTypeVariant(type)).not.toBe('pending');
    }
  });

  it('distinguishes check-in from check-out so present and absent never share a hue', () => {
    expect(sessionTypeVariant('CHECKIN')).toBe('seal');
    expect(sessionTypeVariant('CHECKOUT')).toBe('pen');
  });

  it('falls back to a neutral hue for unknown session types instead of guessing a state', () => {
    expect(sessionTypeVariant('SOMETHING_NEW')).toBe('neutral');
  });

  it('never paints an unknown event status as a real state', () => {
    expect(eventStatusVariant('active')).toBe('seal');
    expect(eventStatusVariant('closed')).toBe('danger');
    expect(eventStatusVariant('unknown-future-status')).toBe('neutral');
  });
});

describe('Touch target floor', () => {
  it('enforces 44px minimum target height on interactive elements', () => {
    const violations: string[] = [];
    const clientDir = join(process.cwd(), 'src/client');

    function collect(dir: string, acc: string[] = []): string[] {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full, acc);
        else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) acc.push(full);
      }
      return acc;
    }

    const files = collect(clientDir);
    const UNDERSIZED_RE = /\b(?:min-[hw]-\[3\dpx\]|[hw]-(?:8|9))\b/;

    for (const file of files) {
      const rel = file.slice(clientDir.length + 1);
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');

      lines.forEach((line, idx) => {
        const clean = line.replace(/\/\*.*?\*\/|\/\/.*/, '');
        if (!UNDERSIZED_RE.test(clean)) return;

        const isInteractive =
          /<button|<a\s|role=["'](?:button|tab)["']|iconButtonClass|sizeClasses|actionClass|LogoutButton/.test(
            clean
          ) || /<[A-Z]\w+[^>]*\b(?:onClick|onToggle|onClose|onSelect)\b/.test(clean);

        if (isInteractive && !clean.includes('touch-target') && !clean.includes('min-h-[44px]')) {
          violations.push(`${rel}:${idx + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      violations,
      `Interactive elements below 44px violate touch target floor:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
