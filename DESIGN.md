# AMS design system

Rules for coding agents working in this repo. Every count, line number, and
contrast ratio here was verified against source and a production build; if you
change the design, update this file in the same change.

`AGENTS.md` holds the project workflow (commands, stack, domain vocabulary) and
the anti-slop rules. This file holds the **visual and structural language**:
what the tokens mean, which utility to reach for, and the layouts that were
fixed and must not regress.

## Stack

Tailwind **v3.4.15**. Tokens are JS literals in `tailwind.config.js` with a
programmatic `state()` ramp (`:16-27`) that derives 50→950 from a single base hex
by tinting toward `#FDFBF7` and shading toward black. There is **no `@theme`
block and no `--color-*` CSS variable**. Do not introduce v4 syntax, and do not
add a CSS-variable indirection layer — the ramp is computed, and `bg-pen-500`
is the only honest way to name the base.

## The two grounds

Everything in the app paints on one of two grounds. This is the single most
important rule in the file: **the ground is frequently an ancestor**, so a text
token that looks right in isolation can be invisible in place.

| Ground | Painted by | Text family |
|---|---|---|
| **Paper** | page background, `surface`, `paper-raised`, cards | `text-ink`, `text-ink-2`, `text-ink-3` |
| **Ink (dark chrome)** | shell root, sidebar, header, dock, backdrops, camera overlay | `text-paper`, `text-paper/80`, `text-paper/70` |

On a dark ground there is **no "muted" ink token**. `text-ink-2` on `bg-ink/90`
computes to **1.31:1** — the camera overlay bug. `text-paper/70` on the same
ground is 6.70:1.

Three sanctioned tokens, no more:

- `bg-pen-500` is the one saturated surface. Pair with `text-paper`.
  `text-ink` on it is 2.94:1.
- `text-white` is legal in exactly two places: a dark ground, and the QR
  overlay on the photographic template in `PrintBadgeSheet.tsx:329` /
  `TemplateIdCard.tsx:214`, which carries its own dark `drop-shadow`. Nowhere
  else — white on `paper-raised` is 1.06:1.
- `rule` and `rule-strong` are hairlines only (1.32:1 / 1.87:1). Never text.

Verify any new text/ground pair at real token values before shipping it. The
`tailwind.config.js` header records the AA-clearing ratios for every text token
on paper.

## Token ramps

Four signal hues, each a `state()` ramp plus a flat `*-deep` for saturated text:

| Hue | Base | Reserved for |
|---|---|---|
| `pen` | `#B03A2E` | breach and live action; `danger` shares this base on purpose |
| `seal` | `#2F6F52` | confirmed / present |
| `pending` | `#8A5A12` | grace period, awaiting |
| `info` | `#3F5C7A` | neutral informational |

**A bare hue name on a ramp emits nothing.** `text-pen` is not a class —
`pen` is an object with a `50`…`950` scale, so `text-pen` silently produces no
CSS. Use `text-pen-deep` for text, `bg-pen-500` for the base fill,
`bg-pen-50/70` for a tint. This is the exact bug the dead-class guard exists to
catch: `text-pen`, `bg-pen`, `bg-info`, `border-l-pending` all looked correct in
the JSX and rendered as nothing.

Radius names double as utility shorthands (`:78-83`): `rounded-bezel` (0.75rem),
`rounded-core` (calc), `rounded-panel` (0.875rem), `rounded-chip` (0.5rem).

z-layers (`:84-91`) are ordered; do not invent new numbers: `sticky` 20,
`reveal` 30, `bar` 40, `dock` 50, `modal` 60, `toast` 70.

## Hand-written utilities

`index.css` defines these as **plain CSS with literal values, never `@apply`** —
they must keep winning the cascade position against a `bg-*` utility a caller
may also write. When you add one, add it to the reduced-motion block if it
animates.

| Class | Does | Use for |
|---|---|---|
| `.surface` | `#faf8f3` fill + `1px solid #d8d3c7` | resting panel (49 uses, 25 files) |
| `.surface-raised` | same + `0 1px 2px rgba(26,24,21,.06)` | one level up the stack (17) |
| `.shadow-lift` | `0 4px 12px -2px rgba(26,24,21,.18)` | edge lift on a raised panel (4) |
| `.bezel` | `border-radius: 0.75rem` | outer rounding shorthand (8) |
| `.bezel-core` | `border-radius: 0.5rem` | inner rounding (3) |
| `.rail` | `2px` wide, `9999px` radius | active sidebar/dock accent |
| `.rail-pulse` | `.rail` + one-shot 600ms fade | settle-in on active item (2) |
| `.pop-once` | one-shot emphasis | single events, not loops (3) |

`.rail` sets **width only**. Height/stretch and colour live at the call site, so
one primitive serves the sidebar rail, the scan outcome row, and the modal
accent edge without a variant prop.

`.modal-backdrop-full` (`index.css:33`) is the scrim behind modals:
`rgba(26,24,21,0.55)`, `z-index: 60`, `100dvw`/`100dvh`.

## Motion

- Never `transition-all`. Name the properties: `transition-colors`,
  `transition-transform`, `transition-opacity`.
- `animate-in`, `fade-in`, `zoom-in-95`, `slide-in-from-*` **are not defined**.
  They emit zero CSS. (0 uses remain.)
- Looping `animate-bounce` on an icon is noise after the first second. Use
  `.pop-once`. Reserve looping `animate-pulse` for genuinely ongoing state (the
  offline banner).
- `prefers-reduced-motion` is handled globally in `index.css:268`. **Any new
  custom animation must be registered** in that block — the list is
  `.pop-once, .rail-pulse, .scan-sweep, .reveal-up, .toast-progress,
  .skeleton-shimmer, .animate-pulse, .animate-spin`.

## Overlays and backdrops

`FloatingSurface` is the one primitive for every transient surface (bulk bar,
scan toast, install banner, recent-scans sheet). Two rules it enforces so no
consumer can escape them:

1. **Backdrops are click-through by construction** (`FloatingSurface.tsx:55`).
   The backdrop is `pointer-events-none`; the content is `pointer-events-auto`.
   A full-viewport scrim that eats pointer events blocks the page underneath a
   surface whose owner already closed it — that was the "multi-action gets
   blocked" bug. Never re-add `pointer-events` to a backdrop.
2. **Gate the render, not the CSS.** A collapsible surface passes `open={isOpen}`
   (default `true`, so a bar that owns its own presence needs no flag); when
   `open === false` the component returns `null` — see
   `RecentScansSheet.tsx:48`. A collapsed sheet must not paint a backdrop at
   all. Follow the existing `if (count === 0) return null;` pattern in
   `SelectionBar.tsx`.

Escape handling, focus trap, and focus restore all belong to `ModalPortal`.
Do not re-implement them per modal.

## Reachability (mobile)

- Use `100dvh`, never `100vh` — mobile browser chrome collapses and a `100vh`
  basis sizes against a stale viewport. The shell roots on
  `h-[100dvh]` (`MobileShell.tsx:129`); pages subtract the chrome, e.g.
  `min-h-[calc(100dvh-8rem)]` (`ScannerPage.tsx:157`).
- **Never `overflow-hidden` on a page root.** It clips content with no way to
  reach it. `LoginPage` uses `min-h-[100dvh] … overflow-y-auto overflow-x-hidden`.
- The shell scroll container is `overflow-x-auto`, not `hidden`
  (`MobileShell.tsx:203`): a too-wide child must become horizontally scrollable,
  not vanish.
- `w-screen` is a trap — it is the *viewport* width, so `w-screen` plus padding
  overflows. Bound a drawer by its wrapper (`w-full max-w-md`), never by the
  viewport.
- `PageHeader`'s action row is `w-full min-w-0 flex-wrap … sm:w-auto sm:shrink-0`.
  `shrink-0` alone held a wide primary button at 467px and overflowed a 420px
  viewport even though the header itself wrapped.
- Long-text cells get `truncate` + `max-w-*` or `break-words`.

## Mobile-first ordering

Reorder sections with `order-*` on siblings plus an `md:` restore — never by
moving DOM and duplicating markup. `ScannerPage` is the reference: camera
`order-1 md:order-2` (leads on mobile because the sheet and controls stack over
it), control card `order-2 md:order-1` (desktop reads controls first). Restore
both at `md` so a wide viewport gets the desktop arrangement back.

`Tabs` fills its width with `flex-1` on each item and `justify-center` on the
tablist, so a two-label login switcher splits the card evenly instead of packing
left. `shrink-0` + `overflow-x-auto` stay on the tablist so a four-label
settings bar still scrolls rather than squashing. Consumers needing
content-width tabs pass `variant="pill"` or a `className` override — there is no
`fill` prop.

## Anti-slop

Carried forward from `AGENTS.md` because these are design-language rules, not
just style:

- No blurred pulsing background orbs.
- `.surface` / `.surface-raised` already set `background` and `border`; do not
  stack a `bg-*` or `border-*` utility on the same element.
- Icon tiles that merely repeat an adjacent text label are noise.
- An uppercase tracked capsule above every heading is template grammar: one per
  page section at most, and only when it carries real status.
- Never display hardcoded facts as if live. The System tab reports real runtime
  state only.
- Never `.catch(() => null)` on a dashboard load; use `Promise.allSettled` and
  show which sections failed (`DashboardPage.tsx` `partialErrors`).

## Verify before yielding

Types, tests, and a green build do **not** prove a change is visible. The §1
paper cutover left 148 invisible elements behind while all three passed.

```bash
npx tsc --noEmit -p tsconfig.json   # 0 errors
npx vitest run                       # tests
npm run build
npm run build && (cd dist && python3 -m http.server 5175 --bind 127.0.0.1)
```

`vite` serves over TLS with a self-signed cert, so use the plain-HTTP static
build. For any change to colour, ground, or layout, load the page and look at
it at both a phone width (≤420px) and desktop (≥1280px); check
`document.documentElement.scrollWidth === clientWidth` for overflow.

Two guards enforce the mechanical half of this file:
`tests/text-contrast-guard.test.ts` (ground-aware contrast + dead-utility
detection) and `tests/lib/dead-utility-classes.ts` (resolves opacity,
arbitrary, and variant forms by compiling candidates through PostCSS, so it
never false-alarms on real utilities).
