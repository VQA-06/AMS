import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  findDeadClasses,
  findUnusedLocalCss,
  tailwindSelectorsFor,
  localCssClasses,
  scanSource,
} from './lib/dead-utility-classes';
import { scanFile, findDarkGroundInkText } from './lib/contrast-grounds';

const CLIENT = join(process.cwd(), 'src/client');

/**
 * Ground tokens that are genuinely dark, so light text is correct on them.
 * Alpha variants count: `bg-ink/90` composites to ~#302E2A over paper, which
 * is still a dark ground. `DARK_GROUND_RE` matches the bare token plus any
 * `/opacity` suffix, so a new shade cannot slip in undeclared.
 */
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
const DARK_GROUND_RE = new RegExp(
  DARK_GROUNDS.map((g) => `${g}(?![\\w-]*(?:paper|[\\d]))(?:\\/\\d+)?`).join('|')
);

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
        const onDark = DARK_GROUND_RE.test(context);
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
  it('never paints ink text on a dark ground', () => {
    // A ground is only a ground for what it paints, so this walks the JSX
    // element stack rather than the source lines: the defect it exists for is
    // `bg-ink/90` on a container with `text-ink` on the children beneath it,
    // which no line-local check can see. The nearest ground wins in both
    // directions, so a `<select className="bg-ink/80">` whose options are
    // `className="bg-paper text-ink"` stays legal — the option paints its own
    // paper. `tests/lib/contrast-grounds.ts` holds the scanner.
    const offenders = files.flatMap((file) =>
      scanFile(file.slice(CLIENT.length + 1), file)
    );

    expect(
      offenders.map((o) => `${o.at}  ${o.text}`),
      `a dark ground painted under ink text:\n${offenders
        .map((o) => `${o.at}  ${o.text}`)
        .join('\n')}`
    ).toEqual([]);
  });
  it('detects ink text on dark grounds including bg-ink (ownGround regression check)', () => {
    const syntheticOffenders = findDarkGroundInkText(
      'synthetic.tsx',
      '<div className="bg-ink"><p className="text-ink-2">x</p></div>'
    );
    expect(syntheticOffenders.length).toBe(1);
    expect(syntheticOffenders[0].text).toContain('text-ink-2');
  });

  it('uses no undefined utility class', async () => {
    // A class name no stylesheet defines renders as no CSS at all — the element
    // is unstyled and no other check notices. `tests/lib/dead-utility-classes`
    // resolves each candidate against the real Tailwind theme and the
    // hand-written layer in `index.css`; see that file for why PostCSS, not
    // `getClassList()`, is the authority.
    const dead = await findDeadClasses();
    const listed = dead.map((d) => `${d.file}:${d.at}  ${d.token}`);

    expect(listed, `classes that no stylesheet defines render as no CSS:\n${listed.join('\n')}`).toEqual(
      []
    );
  });

  it('resolves opacity, arbitrary, and variant forms', async () => {
    // `getClassList()` is not a usable authority here: it returns bare scale
    // names and would report every one of these as undefined, so the guard
    // would be permanently red and its signal worthless. Compiling the
    // candidates as Tailwind `content` is what actually answers them.
    const resolved = [
      'bg-pen-50/70', // opacity modifier
      'text-ink/70',
      'border-rule/60',
      'text-[12px]', // arbitrary value
      'min-h-[calc(100dvh-8rem)]',
      'max-w-[320px]',
      'hover:bg-pen-50/70', // variant, combined with opacity
      'md:order-1',
      'focus-visible:ring-2',
    ];
    const local = ['surface', 'surface-raised', 'rail', 'rail-pulse'];
    const emitted = await tailwindSelectorsFor([...resolved, ...local]);
    const handWritten = localCssClasses();

    const unresolved = [...resolved, ...local].filter(
      (t) => !emitted.has(t) && !handWritten.has(t)
    );

    expect(unresolved, `a real utility the resolver cannot answer:\n${unresolved.join('\n')}`).toEqual(
      []
    );
  });

  it('reports a genuinely undefined utility', async () => {
    // The complement of the test above: a bare hue on a state scale, and a
    // spacing step that does not exist. Both are what the §1 cutover left
    // behind — unstyled markup that renders silently.
    const dead = ['text-pen', 'bg-info', 'border-l-pending', 'py-0.2'];
    const emitted = await tailwindSelectorsFor(dead);
    const handWritten = localCssClasses();

    expect(dead.filter((t) => emitted.has(t) || handWritten.has(t))).toEqual([]);
  });

  it('sees classes held in an object-literal tone map', () => {
    // The guard originally keyed class maps on their variable *name*, so
    // `const PANEL: Record<ModalType, { rail: string; … }>` was invisible —
    // and that is exactly where `bg-info` hid in both modals. Two further
    // traps: `scanClassExpression` skips a nested `{`, discarding the values
    // the map exists to hold, and reading *every* string would report the
    // enum fields and UI prose as dead utilities.
    //
    // Run against synthetic source, so the test pins the scanner's behaviour
    // rather than the contents of whichever component happens to hold the map.
    const tokens = (src: string) => scanSource(src).map(([text]) => text).join(' ').split(/\s+/);

    const toneMap = `
      const PANEL: Record<ModalType, { rail: string; confirm: 'danger' | 'outline' }> = {
        danger: { rail: 'bg-pen-500', confirm: 'danger' },
        info: { rail: 'bg-info-500', confirm: 'outline' },
      };
    `;
    const found = tokens(toneMap);

    expect(found, 'a class map value was not collected').toContain('bg-info-500');
    expect(found, 'a class map value was not collected').toContain('bg-pen-500');
    expect(found, 'an enum field was read as a class list').not.toContain('danger');
    expect(found, 'an enum field was read as a class list').not.toContain('outline');
  });

  it('does not read a label map as a class list', () => {
    // `Record<TabKey, string>` in `MobileShell` holds Indonesian UI copy.
    // Treating it as a class list flags every word in it, which is what a
    // too-broad object-valued rule did.
    const labelMap = `const tabLabels: Record<TabKey, string> = { dashboard: 'Beranda Operasional' };`;

    expect(
      scanSource(labelMap).map(([text]) => text),
      'a string-valued label map was read as classes'
    ).toEqual([]);
  });
  it('defines no unused CSS classes in index.css (bidirectional check)', () => {
    const unused = findUnusedLocalCss();
    expect(
      unused.map((u) => `index.css:${u.line} .${u.className}`),
      `CSS classes defined in index.css with no usage in client:\n${unused
        .map((u) => `index.css:${u.line} .${u.className}`)
        .join('\n')}`
    ).toEqual([]);
  });

  it('grounds viewport height on dvh and rejects raw screen viewport utilities', () => {
    const violations: string[] = [];
    const VIEWPORT_SCREEN_RE = /\b(?:min-h-screen|(?<!\w)h-screen|min-w-screen|(?<!\w)w-screen)\b/;

    for (const file of files) {
      const rel = file.slice(CLIENT.length + 1);
      const raw = readFileSync(file, 'utf8');
      const noComments = raw
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/.*/g, '');
      const lines = noComments.split('\n');
      lines.forEach((line, idx) => {
        if (VIEWPORT_SCREEN_RE.test(line)) {
          violations.push(`${rel}:${idx + 1}  ${line.trim()}`);
        }
      });
    }

    const indexHtml = readFileSync(join(process.cwd(), 'index.html'), 'utf8').split('\n');
    indexHtml.forEach((line, idx) => {
      const codeOnly = line.replace(/<!--.*?-->/, '');
      if (VIEWPORT_SCREEN_RE.test(codeOnly)) {
        violations.push(`index.html:${idx + 1}  ${line.trim()}`);
      }
    });

    expect(
      violations,
      `Raw screen viewport utilities violate DESIGN.md dvh basis:\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('ensures exactly one scroll container per table without parent overflow-x', () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file.endsWith('Table.tsx')) continue;
      const src = readFileSync(file, 'utf8');
      if (!src.includes('<Table')) continue;

      const rel = file.slice(CLIENT.length + 1);
      const clean = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const tagRe = /<(\/?[a-zA-Z0-9]+)([^>]*)>/g;
      const stack: { tag: string; hasOverflowX: boolean }[] = [];
      let match: RegExpExecArray | null;

      while ((match = tagRe.exec(clean)) !== null) {
        const isClosing = match[1].startsWith('/');
        const tagName = isClosing ? match[1].slice(1) : match[1];
        const attrs = match[2];
        const isSelfClosing = attrs.endsWith('/') || ['img', 'input', 'br', 'hr'].includes(tagName);

        if (isClosing) {
          let idx = -1;
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].tag === tagName) {
              idx = i;
              break;
            }
          }
          if (idx !== -1) stack.splice(idx);
        } else {
          const hasOverflowX =
            /className=["'][^"']*\boverflow-x-(?:auto|scroll)\b/.test(attrs) ||
            /className=\{[^}]*\boverflow-x-(?:auto|scroll)\b/.test(attrs);

          if (tagName === 'Table') {
            const badAncestor = stack.find((item) => item.hasOverflowX);
            if (badAncestor) {
              const line = clean.slice(0, match.index).split('\n').length;
              violations.push(`${rel}:${line} <Table> wrapped in ancestor <${badAncestor.tag}> with overflow-x`);
            }
          }

          if (!isSelfClosing) {
            stack.push({ tag: tagName, hasOverflowX });
          }
        }
      }
    }

    expect(
      violations,
      `Table already owns the scroll container; outer overflow-x is redundant:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});