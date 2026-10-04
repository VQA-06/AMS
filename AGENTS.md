# AGENTS.md

Guidance for AI coding agents working in this repository.

## Stack

Hono on Cloudflare Workers (server) + React SPA (client) + Cloudflare D1.
Client source lives in `src/client`, server in `src/server`.

## Before You Edit

```bash
npx tsc --noEmit -p tsconfig.json   # types must stay at zero errors
npx vitest run                       # 164 tests
npm run build
```

Run all three after any change that touches `src/client` or `src/server`.

## UI anti-slop rules

These encode fixes already applied to this codebase. Do not reintroduce them.

**Motion**
- Never use `transition-all`. List the properties: `transition-colors`,
  `transition-transform`, `transition-opacity`. `transition-all` makes the
  browser watch every property and triggers layout/paint nobody asked for.
- The `animate-in` / `fade-in` / `zoom-in-95` / `slide-in-from-*` classes are not
  defined in `index.css`. They emitted zero CSS and are dead weight.
- A looping `animate-bounce` on an icon is noise after the first second. Use
  `.animate-pop-once` for one-shot emphasis. Reserve looping `animate-pulse` for
  genuinely ongoing state (e.g. the offline banner).
- `prefers-reduced-motion` is handled globally in `index.css`. New custom
  animations must be added to that block.

**Accessibility**
- Never `focus:outline-none` alone. Use the ring quartet:
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`
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
- `glass-panel` already sets `background` and `border`. Do not stack a `bg-*` or
  `border-*` utility on the same element — the override silently fights it.
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
