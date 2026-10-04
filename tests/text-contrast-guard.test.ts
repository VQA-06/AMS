import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CLIENT = join(process.cwd(), 'src/client');

/** Ground tokens that are genuinely dark, so light text is correct on them. */
const DARK_GROUNDS = [
  'bg-ink',
  'bg-black',
  'bg-slate-9',
  'bg-slate-8',
  'bg-zinc-9',
  'bg-zinc-8',
  'bg-neutral-9',
  'bg-neutral-8',
];

/**
 * `text-white` is legal in exactly two places in this codebase: on a dark
 * ground, or over the photographic QR template (which paints its own dark
 * drop-shadow). Everywhere else the paper palette makes it invisible —
 * white on `paper-raised` is 1.06:1.
 *
 * This exists because the §1 paper cutover inverted the ground and left 113
 * of these behind, and nothing caught it: `color-semantics.test.tsx` asserts
 * tone distinctness, not legibility.
 */
function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('text contrast guard', () => {
  const files = collectFiles(CLIENT);

  it('finds the client source tree', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('keeps text-white only on a dark ground or the QR overlay', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = file.slice(CLIENT.length + 1);
      const lines = readFileSync(file, 'utf8').split('\n');

      lines.forEach((line, i) => {
        if (!/\btext-white\b/.test(line)) return;

        // The QR print overlays carry their own dark drop-shadow, which is
        // what makes white readable over the photographic template.
        const qrOverlay = /drop-shadow-\[0_2px_4px_rgba\(0,0,0/.test(line);
        if (qrOverlay) return;

        // Look at the element's own classes first, then the lines above it:
        // a token inherits its ground from an ancestor.
        const context = lines.slice(Math.max(0, i - 12), i + 1).join('\n');
        const onDark = DARK_GROUNDS.some((g) => new RegExp(`${g}(?![\\w-]*paper)`).test(context));
        if (onDark) return;

        offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }

    expect(offenders, `text-white on a paper ground is invisible (1.06:1):\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  it('gives every <option> an explicit colour', () => {
    // A native dropdown paints its list with the OS palette and inherits the
    // *select's* text colour. Inheriting `text-paper` (the shell's light
    // default on dark chrome) renders the open list as blank rows at 1.1:1.
    const offenders: string[] = [];

    for (const file of files) {
      const rel = file.slice(CLIENT.length + 1);
      const lines = readFileSync(file, 'utf8').split('\n');

      lines.forEach((line, i) => {
        if (!/<option\b/.test(line)) return;
        // Self-closing `<option />` (a datalist entry) inherits from Field's
        // control, which sets `text-ink`. Only styled, populated options in a
        // raw <select> need an explicit colour.
        if (/\/>\s*$/.test(line) && !/className=/.test(line)) return;
        if (!/className=/.test(line)) return;
        if (/className="[^"]*\btext-(?:ink|paper)\b/.test(line)) return;

        offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }

    expect(
      offenders,
      `<option> without an explicit text colour inherits an unreadable one:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('pairs every bg-pen-500 chip with light text', () => {
    // `bg-pen-500` is the one saturated surface in the palette; dark ink on it
    // measures 2.94:1. Every other chip in the app already uses text-paper.
    const offenders: string[] = [];

    for (const file of files) {
      const rel = file.slice(CLIENT.length + 1);
      const lines = readFileSync(file, 'utf8').split('\n');

      lines.forEach((line, i) => {
        if (!/bg-pen-500/.test(line)) return;
        if (/text-paper/.test(line)) return;
        if (/(mark|rail|dot)Class|railClass|^\s*pen:|^\s*danger:/.test(line)) return;
        if (/text-ink(?![\w-])/.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
    }

    expect(offenders, `bg-pen-500 with dark text is 2.94:1:\n${offenders.join('\n')}`).toEqual([]);
  });
  it('never pairs a dark ground with dark text', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = file.slice(CLIENT.length + 1);
      const lines = readFileSync(file, 'utf8').split('\n');

      lines.forEach((line, i) => {
        // `bg-ink-3` and friends are mid-greys, not dark grounds — only the
        // bare `bg-ink` token (no numeric shade) is a dark ground.
        if (!/bg-ink(?![-\w])/.test(line)) return;
        // A bg-ink container with text-ink as its own colour is light-on-dark
        // inverted — the whole subtree inherits invisible text.
        if (!/(^|["'\s])text-ink(["'\s]|$)/.test(line)) return;
        offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }

    expect(offenders, `bg-ink paired with text-ink:\n${offenders.join('\n')}`).toEqual([]);
  });
});