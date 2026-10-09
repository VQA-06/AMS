# AGENTS.md

Guidance for AI coding agents working in this repository.

## Stack

Hono on Cloudflare Workers (server) + React SPA (client) + Cloudflare D1.
Client source lives in `src/client`, server in `src/server`.

## Design system

`DESIGN.md` is the authority on the visual and structural language: the two
grounds (paper vs dark chrome) and which token family paints each, the four
signal ramps, the hand-written `index.css` utilities, motion rules, the
`FloatingSurface` overlay contract, mobile reachability (`100dvh`, never
`overflow-hidden` on a root, `w-screen` is a trap), and `order-*` mobile
ordering. Read it before changing any colour, ground, or layout, and keep it
accurate when you change the design — every number in it is verified against
source and a production build.

## Before You Edit

```bash
npx tsc --noEmit -p tsconfig.json   # types must stay at zero errors
npx vitest run                       # 41 test files, 333 tests
npm run build
```

Run all three after any change that touches `src/client` or `src/server`.

Types, unit tests, and a green build do not prove a change is *visible*. The
§1 paper cutover left 148 invisible elements behind while all three passed.
For any change to colour, ground, or layout, also run the app and look at it:

```bash
npm run build && (cd dist && python3 -m http.server 5175 --bind 127.0.0.1)
```

`vite` serves over TLS (`@vitejs/plugin-basic-ssl`) with a self-signed cert,
so a browser must be launched with HTTPS errors ignored; the static build on
plain HTTP avoids that entirely.

## UI anti-slop rules

These encode fixes already applied to this codebase. Do not reintroduce them.

**Motion**
- Never use `transition-all`. List the properties: `transition-colors`,
  `transition-transform`, `transition-opacity`. `transition-all` makes the
  browser watch every property and triggers layout/paint nobody asked for.
- The `animate-in` / `fade-in` / `zoom-in-95` / `slide-in-from-*` classes are not
  defined in `index.css`. They emitted zero CSS and are dead weight.
- A looping `animate-bounce` on an icon is noise after the first second. Use
  `.pop-once` for one-shot emphasis. Reserve looping `animate-pulse` for
  genuinely ongoing state (e.g. the offline banner).
- `prefers-reduced-motion` is handled globally in `index.css`. New custom
  animations must be added to that block.

**Token ramps**
- A bare hue name on a ramp emits nothing. `text-pen` is not a class — `pen` is
  a `state()` object with a `50`…`950` scale, so `text-pen` renders as no CSS.
  Use `text-pen-deep` for text, `bg-pen-500` for the base fill, `bg-pen-50/70`
  for a tint. Same for `bg-info`, `border-l-pending`. This silently-bit the
  codebase once; `tests/text-contrast-guard.test.ts` now enforces it.

**Overlays**
- Backdrops are click-through by construction. `FloatingSurface`'s backdrop is
  `pointer-events-none` with `pointer-events-auto` on the content — never
  re-add pointer events to a backdrop, or a closed surface's scrim blocks the
  page under it.
- Gate the render, not the CSS: a collapsible surface passes `open={isOpen}` to
  `FloatingSurface` (default `true`) and `open === false` returns `null`. A
  collapsed sheet must not paint a backdrop at all.

**Reachability**
- Use `100dvh`, never `100vh`. Never `overflow-hidden` on a page root — it
  clips content with no way to scroll to it. `w-screen` is the viewport width,
  so it overflows when combined with padding; bound a drawer by its wrapper
  (`w-full max-w-md`) instead.

**Contrast**
- Never choose a text token without checking the ground that actually paints
  it. The ground is frequently an *ancestor*: the shell root, the dark sidebar,
  or the dark header. A `text-ink-2` that looks right in isolation is 2.27:1
  on `bg-ink`, and `text-seal-600` on `bg-ink` is 2.38:1. State-ramp tokens
  (`text-seal-400`, `text-pending-400`, …) are the correct step on a dark
  ground, not their `-600` counterparts (`text-seal-400` on `ink` is 5.74:1).
- The app has two grounds. Paper content uses `text-ink*`. Dark chrome (shell
  root, sidebar, header, dock, full-bleed overlays) uses `text-paper*`. On a
  dark ground there is no "muted" ink token — use `text-paper/70`.
- `text-white` is legal in exactly two places: a dark ground, and the QR
  overlay text on the photographic template (which carries its own dark
  drop-shadow). Nowhere else — white on `paper-raised` is 1.06:1.
- `bg-pen-500` is the one saturated surface. Pair it with `text-paper`;
  `text-ink` on it is 2.94:1.
- Give every `<option>` an explicit text colour. A native dropdown inherits the
  *select's* colour, so an option that looks fine in the closed control can
  render blank in the open list.
- `tests/text-contrast-guard.test.ts` enforces the mechanical half of this at
  the source level. It reads classNames and cannot resolve an inherited ground,
  which is exactly where the shell bug lived — verify those in a browser.

**Accessibility**
- Never `focus:outline-none` alone. Use the ring quartet:
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper`
  (`ring-pen-500` is the variant on filled primary buttons; `focusRing` in
  `MobileShell` owns it for nav items. The old `sky-400`/`slate-950` values
  emit no CSS after the paper cutover.)
- Every `<input>`, `<select>`, `<textarea>` needs a real `<label htmlFor>`, or an
  `aria-label`. Ids follow `<file-path>-field-<n>`.
- Icon-only buttons need `aria-label`. Password toggles also need `aria-pressed`.
- Role `button` on a `<div>` must be a real `<button>`. Interactive elements are
  never nested.
- Heading levels must not skip (h2 → h3, never h2 → h4).

**Honesty**
- Never `.catch(() => null)` on a dashboard load. A partial outage rendered as
  plausible zeros looks like real data. Use `Promise.allSettled` and show which
  sections failed — see `DashboardPage.tsx` `partialErrors`.
- Do not display hardcoded facts as if they were live. The System tab reports
  real runtime state (display mode, service worker, connectivity) and nothing
  else. Static claims about the stack were deleted; do not re-add them.

**Decoration**
- No blurred pulsing background orbs.
- `.surface` and `.surface-raised` already set `background` and `border`. Do not
  stack a `bg-*` or `border-*` utility on the same element — the override
  silently fights it. If one call site needs a different fill, give it an
  explicit `bg-*` there rather than weakening the shared class.
- Icon tiles that merely repeat an adjacent text label are noise.
- An uppercase tracked capsule above every heading is template grammar. One per
  page section at most, and only when it carries real status.

**Tables**
- Every `<table>` sits in an `overflow-x-auto` container and has a sticky or
  bounded header for long lists.
- Long-text cells get `truncate` + `max-w-*` or `break-words` so they cannot
  stretch the layout.

## Domain vocabulary

Match these names exactly — the server and tests are keyed on them.

| Concept | Field |
| --- | --- |
| Event location | `location_name` |
| Grace period | `grace_minutes` |
| QR policy | `qr_policy` (`universal_allowed`, …) |
| Allowed session modes | `session_modes` |
| Manual attendance | `allow_manual_attendance` |
| QR token fields | `qr_token`, `scope`, `jti` |
| Session types | `checkin`, `checkout`, `breakOut`, `breakIn` |
| Row timestamps | `metadata`, `created_at`, `updated_at` |

HTTP status codes are imported from `hono/utils/http-status` as
`ContentfulStatusCode` — do not cast with `as StatusCode`.

## Layout

- `src/client` holds the React SPA; shared primitives are in
  `src/client/components/ui` (`Button`, `Badge`, `ModalPortal`,
  `ConfirmModal`, `AlertModal`).
- Modals all route through `ModalPortal`, which owns the scroll lock, Escape
  handling, focus trap, and focus restore. Callers supply their own close
  callback via `onClose`. Do not re-implement any of that per modal.
