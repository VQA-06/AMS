import { readFileSync } from 'node:fs';

/**
 * Ground-aware contrast scanning for JSX.
 *
 * The existing line-based checks in `text-contrast-guard.test.ts` cannot see a
 * ground that lives on a different element from the text. That is exactly the
 * defect class this module closes: the scanner walks the JSX element stack and
 * resolves, for every text token, the nearest ground that actually paints
 * beneath it — its own, else the closest ancestor's.
 *
 * Two rules make it useful rather than noisy:
 *
 *   - A ground counts only from a `bg-*` utility with no variant prefix.
 *     `hover:bg-ink` and `md:bg-ink/90` do not paint the resting state.
 *   - The nearest ground wins, in both directions. `<select className="bg-ink/80
 *     text-paper">` whose options are `className="bg-paper text-ink"` is correct
 *     — the option paints its own paper, so its ink text is legible. A scanner
 *     that took the outermost ground would flag it.
 */

/** Ground tokens that are genuinely dark, so light text is correct on them. */
export const DARK_GROUNDS = [
  'bg-ink',
  'bg-black',
  'bg-slate-9',
  'bg-slate-8',
  'bg-zinc-9',
  'bg-zinc-8',
  'bg-neutral-9',
  'bg-neutral-8',
];

const DARK_GROUND_NAMES = new Set(DARK_GROUNDS);

/** `text-ink`, `text-ink-2`, `text-ink-3`, and their opacity variants. */
const INK_TEXT = /^text-ink(?:-\d)?(?:\/\d+)?$/;

export interface ContrastOffender {
  at: string;
  text: string;
}

interface OpenTag {
  name: string;
  attrs: string;
  selfClosing: boolean;
  end: number;
}

/** String literals and `${…}` placeholders inside a class expression. */
function literalsIn(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== c) {
        if (c === '`' && text[j] === '$' && text[j + 1] === '{') {
          value += ' ';
          let braces = 1;
          j += 2;
          while (j < text.length && braces > 0) {
            if (text[j] === '{') braces++;
            else if (text[j] === '}') braces--;
            j++;
          }
          continue;
        }
        value += text[j];
        j++;
      }
      out.push(value);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

/**
 * Class tokens from a `className` attribute value. A quoted string is taken
 * whole; a `{…}` expression contributes its string literals, so `cn('a',
 * cond && 'b')` and `` cn(`a ${extra}`) `` are both covered and an
 * interpolated name (`${surfaceClass}`) is left as an unknown rather than
 * mistaken for a token.
 */
function classTokens(value: string): string[] {
  const quoted = /^(["'`])/.exec(value.trim());
  if (quoted) {
    const quote = quoted[1];
    const end = value.lastIndexOf(quote);
    return value.trim().slice(1, end).split(/\s+/).filter(Boolean);
  }
  if (!value.trim().startsWith('{')) return [];
  const inner = value.trim().slice(1, value.lastIndexOf('}'));
  return literalsIn(inner).flatMap((literal) => literal.split(/\s+/)).filter(Boolean);
}

/** Reads an opening tag starting at `<`, tracking quotes and brace depth. */
function readOpenTag(src: string, start: number): OpenTag | null {
  const name = /^[A-Za-z][\w.]*/.exec(src.slice(start + 1));
  if (!name) return null;

  let i = start + 1 + name[0].length;
  const attrsStart = i;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < src.length && src[i] !== c) i++;
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (depth === 0 && c === '>') {
      const attrs = src.slice(attrsStart, i);
      return { name: name[0], attrs, selfClosing: attrs.trimEnd().endsWith('/'), end: i + 1 };
    }
    i++;
  }
  return null;
}

/**
 * The ground this element's own classes paint: `'dark'`, `'light'`, or `null`
 * when it paints none and inherits its ancestor's.
 */
function ownGround(tokens: string[]): 'dark' | 'light' | null {
  let ground: 'dark' | 'light' | null = null;
  for (const token of tokens) {
    if (token.includes(':')) continue;
    if (!token.startsWith('bg-')) continue;
    if (token === 'bg-transparent' || token === 'bg-none' || token.endsWith('/0')) continue;
    const name = token.slice(3).split('/')[0];
    ground = DARK_GROUND_NAMES.has(name) ? 'dark' : 'light';
  }
  return ground;
}

/**
 * Ink text painted on a dark ground, walking the element stack of one file.
 * `rel` only labels the result.
 */
export function findDarkGroundInkText(rel: string, src: string): ContrastOffender[] {
  // Comments can carry example markup; a phantom `<div className="bg-ink">`
  // would ground text that nothing actually paints. Blanking them keeps the
  // line numbering intact.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

  const lineAt = (index: number) => code.slice(0, index).split('\n').length;
  const stack: { name: string; ground: 'dark' | 'light' | null }[] = [];
  const offenders: ContrastOffender[] = [];

  const nearestGround = (): 'dark' | 'light' | null => {
    for (let j = stack.length - 1; j >= 0; j--) {
      if (stack[j].ground) return stack[j].ground;
    }
    return null;
  };

  let i = 0;
  while (i < code.length) {
    if (code[i] !== '<') {
      i++;
      continue;
    }

    const closing = /^<\/\s*([A-Za-z][\w.]*)/.exec(code.slice(i));
    if (closing) {
      const name = closing[1];
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].name === name) {
          stack.length = j;
          break;
        }
      }
      i += closing[0].length;
      continue;
    }

    const tag = readOpenTag(code, i);
    if (!tag) {
      i++;
      continue;
    }

    const attr = /(?:^|\s)className\s*=\s*/.exec(tag.attrs);
    const tokens = attr ? classTokens(tag.attrs.slice(attr.index + attr[0].length)) : [];
    const ground = ownGround(tokens);
    const effective = ground ?? nearestGround();

    if (effective === 'dark' && tokens.some((t) => INK_TEXT.test(t))) {
      const line = lineAt(i);
      offenders.push({
        at: `${rel}:${line}`,
        text: src.split('\n')[line - 1].trim().slice(0, 100),
      });
    }

    if (tag.selfClosing) {
      i = tag.end;
      continue;
    }
    stack.push({ name: tag.name, ground });
    i = tag.end;
  }

  return offenders;
}

/** Convenience wrapper for reading a file off disk. */
export function scanFile(rel: string, path: string): ContrastOffender[] {
  return findDarkGroundInkText(rel, readFileSync(path, 'utf8'));
}