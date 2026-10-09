import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import type { Config } from 'tailwindcss/types/config';
import tailwindConfig from '../../tailwind.config.js';

/**
 * Class-name resolution for the dead-utility guard.
 *
 * The §1 paper cutover left 148 elements carrying utility names that no
 * stylesheet defines. They render as unstyled markup and nothing catches it:
 * `color-semantics.test.tsx` asserts tone distinctness, not that a token
 * resolves. This module finds them by asking Tailwind which of the tokens
 * written in `src/client` it actually emits, and subtracting.
 *
 * Resolution is PostCSS generation, not a lookup in the flattened theme.
 * `resolveConfig(...).theme` rejects opacity suffixes (`bg-ink/90` → absent),
 * arbitrary values (`h-[100dvh]` → absent) and variant prefixes
 * (`md:order-1` → absent) even though all three emit real CSS. One generation
 * pass over every candidate answers the whole set in about a second.
 *
 * Extraction is the hard half. A regex over string literals cannot tell
 * `cn('bg-pen-500', tone === 'danger' && 'text-pen')` from
 * `onSelectSessionFilter('ALL')` or `variant: 'seal'` — every one of those is
 * a string literal in a class-bearing neighbourhood, and the difference is
 * structural. So this walks the source once and reads a string literal only
 * when the *expression* around it is a class expression:
 *
 *   - the value of `className` / `class`
 *   - an argument of a `cn(…)` / `cxl(…)` call, transitively through
 *     `cond && '…'`, ternaries, and nested merge calls
 *   - the body of a class map — `const variantClasses: Record<Tone, string>`
 *     — which is a class list per key
 *
 * Everything else — `id`, `aria-label`, `placeholder`, `<option value>`,
 * enums, domain values, prose, handler arguments — is never read.
 */

// Repo root derived from this file rather than `process.cwd()`, so the guard
// resolves the same paths under vitest and under a plain `node` run.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLIENT = join(ROOT, 'src/client');

/** A token Tailwind could emit: a letter, then no whitespace or quotes. */
const CANDIDATE = /^[a-zA-Z][\w:./[\]%-]*$/;

/** `cn` and `cxl` are this codebase's class-merging helpers. */
const MERGE = new Set(['cn', 'cxl']);

/**
 * Characters that can only terminate the expression leading up to a literal.
 * `=`, `!` and the comparison operators sit above these in the test below:
 * reaching one of those first means the literal is a compared value.
 */
const EXPR_BOUNDARY = /[,({;&|?:<>]/;
const OPERATOR_CHAR = /[=!<>]/;

export interface DeadClass {
  token: string;
  at: number;
  file: string;
}

/**
 * Whether the literal opening at `at` is a *compared value* rather than a
 * class list. Walking back to the nearest operator tells the two apart:
 * `tone === 'danger' && 'text-pen'` reaches `=` before the literal, whereas
 * `cn('a', x ? 'b' : 'c')` reaches `?` first. `from` bounds the walk to the
 * class expression, so a comparison in the surrounding expression cannot
 * reach in.
 */
function isComparedValue(src: string, from: number, at: number): boolean {
  for (let i = at - 1; i >= from; i--) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') return false;
    if (OPERATOR_CHAR.test(c)) return true;
    if (EXPR_BOUNDARY.test(c)) return false;
  }
  return false;
}


/**
 * Index of the closer matching the bracket at `open` (`{`, `(`, or `[`),
 * skipping strings and comments.
 */
function matchBracket(src: string, open: number): number {
  let i = open + 1;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i = endOfString(src, i);
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      if (depth === 0) return i;
      depth--;
    }
    i++;
  }
  return i;
}

/** Index just past the string literal opening at `start`. */
function endOfString(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length && src[i] !== quote) {
    if (src[i] === '\\') i++;
    else if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
      i = matchBracket(src, i + 1) + 1;
      continue;
    }
    i++;
  }
  return i + 1;
}

/** Index of the next non-whitespace character at or after `from`. */
function skipSpace(src: string, from: number): number {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

/**
 * Static text of a template literal, holes blanked. `` `a ${b} c` `` yields
 * `"a  c"`, so an interpolated name is never mistaken for a class.
 */
function staticText(body: string): string {
  return body.replace(/\$\{[\s\S]*?\}/g, ' ');
}


/**
 * Every string literal between `from` and `end` that sits in a class
 * expression: `cn(…)` arguments, ternaries, `&&` guards, nested merge calls.
 * The bounds are explicit — an earlier version ran to end-of-file and swept in
 * every `id` and `<option value>` that followed the attribute it started in.
 */
function scanClassExpression(src: string, from: number, end: number): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  let i = from;

  while (i < end) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      while (i < end && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < end && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const stop = Math.min(endOfString(src, i), end);
      const body = src.slice(i + 1, Math.max(i + 1, stop - 1));
      if (!isComparedValue(src, from, i)) out.push([c === '`' ? staticText(body) : body, i]);
      i = stop;
      continue;
    }

    if (c === '(') {
      // A nested `cn(…)` is transparent; any other call is opaque and skipped
      // whole, so `labelFor(tone)` contributes nothing.
      const name = /([A-Za-z_$][\w$]*)\s*$/.exec(src.slice(from, i));
      const close = matchBracket(src, i);
      if (name && MERGE.has(name[1])) out.push(...scanClassExpression(src, i + 1, close));
      i = close + 1;
      continue;
    }

    if (c === '{' || c === '[') {
      i = matchBracket(src, i) + 1;
      continue;
    }

    i++;
  }

  return out;
}

/**
 * Field names in an object-literal class map that hold a class list:
 * `rail`, `railClass`, `ringClass`, `text`, `chip`.
 *
 * A map like `Record<Tone, { rail: string; confirm: 'danger' | 'outline' }>`
 * mixes both, and reading each of its strings as a class reports `danger` as
 * a dead utility. So does `Record<ErrorKind, { title: string; desc: string }>`,
 * which holds nothing but prose.
 */
const CLASS_FIELD = /^(?:.*Class|rail|text|chip)$/;

/**
 * String literals held by class fields of an object-literal class map, at any
 * nesting depth: `const PANEL: Record<Tone, { rail: string }> = { danger: {
 * rail: 'bg-pen-500' } }`.
 *
 * `scanClassExpression` cannot be reused here — it treats a nested `{` as a
 * block to skip, which discards exactly the values this map exists to hold.
 */
function scanMapBody(src: string, from: number, end: number): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  let i = from;

  while (i < end) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      while (i < end && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < end && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if (c === '(') {
      i = matchBracket(src, i) + 1;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const stop = Math.min(endOfString(src, i), end);
      const field = /([A-Za-z_$][\w$]*)\s*:\s*$/.exec(src.slice(from, i));
      if (field && CLASS_FIELD.test(field[1])) {
        out.push([src.slice(i + 1, Math.max(i + 1, stop - 1)), i]);
      }
      i = stop;
      continue;
    }

    i++;
  }

  return out;
}

/** The class lists a file declares, each with the offset it starts at. */
export function scanSource(src: string): Array<[string, number]> {
  const found: Array<[string, number]> = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }


    // A template literal at statement level is not a class expression. The one
    // in this codebase is `PrintBadgeSheet`'s print document: its
    // `class="id-card"` selectors are defined by the `<style>` block in the
    // same template, so reading them against Tailwind would report four
    // classes that do resolve — just against a stylesheet this guard does not
    // model. Templates *inside* a class attribute are handled above, where
    // their static parts are still read.
    if (c === '`') {
      i = endOfString(src, i);
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const ident = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))![0];
      const after = i + ident.length;
      const next = skipSpace(src, after);

      // `className="…"` / `class='…'` / `className={…}`
      if ((ident === 'className' || ident === 'class') && src[next] === '=') {
        const v = skipSpace(src, next + 1);
        if (src[v] === '{') {
          const close = matchBracket(src, v);
          found.push(...scanClassExpression(src, v + 1, close));
          i = close + 1;
        } else if (src[v] === '"' || src[v] === "'" || src[v] === '`') {
          const stop = endOfString(src, v);
          const body = src.slice(v + 1, stop - 1);
          found.push([src[v] === '`' ? staticText(body) : body, v]);
          i = stop;
        } else {
          i = after;
        }
        continue;
      }

      // `cn(…)` / `cxl(…)`
      if (MERGE.has(ident) && src[next] === '(') {
        const close = matchBracket(src, next);
        found.push(...scanClassExpression(src, next + 1, close));
        i = close + 1;
        continue;
      }

      // A class map. Two shapes reach the classes, and they need different
      // discriminators:
      //
      //   const PANEL: Record<Tone, { rail: string; … }> = { … }
      //   const variantClasses: Record<Tone, string> = { … }
      //
      // The object-valued form is identified by its value type alone — the
      // map's own name is arbitrary, and matching on `PANEL` or `Classes`
      // missed `ConfirmModal`'s tone map entirely.
      //
      // The string-valued form is ambiguous with a label map
      // (`Record<TabKey, string>` in `MobileShell` holds Indonesian UI copy,
      // and reading it as a class list flags every word in it), so that one
      // keeps the name-based test and stays as it was.
      //
      // An arrow function is not a map: `iconButtonClass = (tone) => cn(…)` is
      // already covered by the merge-call branch above.
      if (ident === 'const') {
        const colon = src.indexOf(':', after);
        const assign = skipSpace(src, src.indexOf('=', colon));
        const body = skipSpace(src, assign + 1);
        const type = src.slice(colon, assign);
        const objectValued = /Record<[^,]+,\s*\{/.test(type);
        const nameValued =
          /[Cc]lass/.test(src.slice(after, colon)) && /Record<[^,]+,\s*string/.test(type);
        if ((objectValued || nameValued) && body < src.length && src[body] === '{') {
          const close = matchBracket(src, body);
          found.push(
            ...(objectValued
              ? scanMapBody(src, body + 1, close)
              : scanClassExpression(src, body + 1, close))
          );
          i = close + 1;
          continue;
        }
      }

      i = after;
      continue;
    }

    i++;
  }

  return found;
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * Every class-name candidate in `dir`, mapped to the first place it appears so
 * a failure names a file and a line.
 */
export function collectClassCandidates(dir: string = CLIENT): Map<string, { at: number; file: string }> {
  const found = new Map<string, { at: number; file: string }>();

  for (const file of collectFiles(dir)) {
    const src = readFileSync(file, 'utf8');
    const rel = file.slice(dir.length + 1);

    for (const [text, at] of scanSource(src)) {
      for (const token of text.split(/\s+/)) {
        if (CANDIDATE.test(token) && !found.has(token)) found.set(token, { at, file: rel });
      }
    }
  }

  return found;
}

export interface UnusedLocalClass {
  className: string;
  line: number;
}

/** Class names defined by the hand-written layer in `index.css`. */
export function localCssClasses(): Set<string> {
  const css = readFileSync(join(CLIENT, 'index.css'), 'utf8');
  return new Set([...css.matchAll(/(?:^|\n)\s*\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]));
}

/**
 * Reports every class defined in `index.css` that has zero occurrences in client JSX/TSX.
 * Strips comments first so comments mentioning e.g. document.body are not read as classes.
 */
export function findUnusedLocalCss(dir: string = CLIENT): UnusedLocalClass[] {
  const css = readFileSync(join(dir, 'index.css'), 'utf8');
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const candidates = collectClassCandidates(dir);
  const usedClasses = new Set<string>();
  for (const token of candidates.keys()) {
    usedClasses.add(token.split(':').pop()!);
  }

  const EXEMPT: Record<string, true> = { 'animate-pulse': true, 'animate-spin': true };

  const unused: UnusedLocalClass[] = [];
  const lines = cleanCss.split('\n');

  lines.forEach((line, index) => {
    const matches = line.matchAll(/(?:^|[\s,{])\.([a-z][a-z0-9-]*)/g);
    for (const match of matches) {
      const className = match[1];
      if (EXEMPT[className]) continue;
      if (!usedClasses.has(className) && !unused.some((u) => u.className === className)) {
        unused.push({ className, line: index + 1 });
      }
    }
  });

  return unused;
}
/**
 * Selectors Tailwind emitted for the supplied candidates.
 *
 * PostCSS is the authority here, not `getClassList()`: only compiling the
 * candidate as `content` resolves the forms the theme alone cannot answer —
 * opacity modifiers (`bg-pen-50/70`), arbitrary values (`text-[12px]`), and
 * variants (`md:order-1`, `hover:bg-pen-50/70`). `getClassList()` returns bare
 * scale names and reports every one of those as undefined.
 *
 * The config is handed to the plugin through one `unknown` cast. Tailwind's
 * published `Config` type is narrower than what its own resolver accepts — it
 * types `theme.extend.zIndex` as `string` and `theme.colors` as a bare
 * `RecursiveKeyValuePair`, both of which this project's config violates while
 * working correctly. The cast is erased at runtime, so a genuinely invalid
 * config still fails loudly inside PostCSS.
 */
export async function tailwindSelectorsFor(tokens: string[]): Promise<Set<string>> {
  const config = tailwindConfig as unknown as Config;
  const result = await postcss([
    tailwindcss({
      ...config,
      content: [{ raw: tokens.join(' ') }],
      corePlugins: { preflight: false },
    }),
  ]).process('@tailwind utilities;', { from: undefined });

  return new Set(
    [...result.css.matchAll(/\.((?:\\.|[^\s,{}+>~:\[\]\(\)}])+)/g)].map((m) =>
      m[1].replace(/\\(.)/g, '$1')
    )
  );
}

/**
 * Candidates that no stylesheet defines. A variant keeps its own form
 * (`md:order-1` is real even when bare `order-1` is not), matching how Tailwind
 * resolves a token; a locally defined utility answers to its bare name because
 * `index.css` selectors carry no variant prefix.
 */
export async function findDeadClasses(dir: string = CLIENT): Promise<DeadClass[]> {
  const sources = new Map(
    collectFiles(dir).map((file) => [file, readFileSync(file, 'utf8')])
  );
  const candidates = collectClassCandidates(dir);
  const emitted = await tailwindSelectorsFor([...candidates.keys()]);
  const local = localCssClasses();

  const dead: DeadClass[] = [];
  for (const [token, where] of candidates) {
    if (emitted.has(token)) continue;
    if (local.has(token.split(':').pop()!)) continue;
    const src = sources.get(join(dir, where.file)) ?? '';
    const line = src.slice(0, where.at).split('\n').length;
    dead.push({ token, at: line, file: where.file });
  }
  return dead;
}