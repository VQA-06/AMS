# Changelog

All notable changes to the Attendance Management System (AMS) are documented in this file.


## [Unreleased]


## [1.4.0] - 2026-04-10

### Added
- **Enterprise Documentation Suite**: Added comprehensive modular documentation manuals in `docs/`: `ARCHITECTURE.md` (edge serverless architecture, request lifecycle, cryptographic subsystems), `API.md` (complete REST API reference across all 7 route modules with Zod schemas and RBAC matrix), `DATABASE.md` (entity schemas, composite index optimization, and migration history 0001-0009), `OPERATIONS.md` (DevOps provisioning, environment matrix, secret rotation, and incident response runbooks), and updated `SECURITY.md` (threat model and Strix penetration test remediation matrix).
- **Root Documentation Overhaul**: Completely updated `README.md` with accurate architectural diagrams, badges (333 tests passing), migration table, and documentation index.

### Fixed
- **Contrast Guard Blind Spot**: Fixed `ownGround` in `tests/lib/contrast-grounds.ts` to accept `bg-` prefix, uncovering and resolving `text-ink-2` on `bg-ink` in `App.tsx` (loading screen) and `TemplateIdCard.tsx` (copy button), and elevated `text-seal-600` to `text-seal-400` for 5.74:1 contrast on ink.
- **Viewport Grounding (`100dvh`)**: Corrected remaining `min-h-screen` / `100vh` compiles in `App.tsx`, `ErrorBoundary.tsx`, and `index.html` to `min-h-[100dvh]`.
- **Accessibility & Pinch-Zoom**: Removed `maximum-scale=1.0, user-scalable=no` from `index.html` viewport meta while retaining `viewport-fit=cover` for safe-area plumbing.
- **Touch Target Floors**: Raised `Button` `sm` size from 36px to 44px (repairing 61 call sites across 21 files), raised the three `iconButtonClass` helpers to 44px, and repaired undersized controls in `SelectionBar`, `Tabs`, `BulkActionBar`, `AlertModal`, `ConfirmModal`, `MobileShell`, `AttendanceRosterTable`, `MemberTrackerPage`, `DigitalPassCard`, `TopEventsChart`, `MembersYearlyChart`, `MembersPage`, `CandidateWorkspace`, `PwaInstallBanner`, `OfflineBanner`, `EventsPage`, `ErrorPage`, and `DashboardPage`.
- **SystemTab Honesty**: Rendered PWA installation badge conditionally based on `isStandalone` runtime state, displaying `Mode Browser` when not standalone.
- **Accessible Inputs & Focus Rings**: Added accessible `id` and `htmlFor` to `GuestPassModal` ticket quantity field, added missing focus rings to stepper buttons and close controls, and migrated hand-rolled inputs to `Field`.
- **Semantic Interactive Controls**: Converted clickable `div` in `TopEventsChart` to standard `<button type="button">` with focus rings.

### Changed
- **Partial Failure Banner Consolidation**: Extended `PartialBanner` with optional `message` and consolidated 6 divergent partial-failure notices across `App.tsx`, `DashboardPage.tsx`, `EventDetailPage.tsx`, `MembersPage.tsx`, `CandidateWorkspace.tsx`, and `EventsPage.tsx`.
- **Badge Pulse Cleanup**: Replaced looping `pulse` animation with static `dot` in `Badge` and `DashboardPage`.
- **Active Navigation Contrast**: Switched desktop sidebar active nav item and settings button to `text-ink` for high contrast against `bg-paper-raised`.
- **Table Scroll Container Deduplication**: Removed redundant `overflow-x-auto` wrapper in `AuditTab.tsx` in favor of `Table`'s native scroll container.
- **One List Grammar**: Converted the attendance roster and the Settings → Tim Panitia account list from `<Table>` to the `RowList` index-card grammar, so neither surface ships two grammars for one list. The deleted columns fold into each row's `meta` line; the RBAC capability matrix keeps its `Table` because its columns are genuinely compared in parallel.
- **Locked Row Selection**: Added `RowList`'s `selectableIds` prop so a row the selection guard refuses (the signed-in account, the default master owner) renders the muted `-` fragment instead of an inert checkbox, keeping the guard visible.
- **Team Row Actions**: Raised the Tim Panitia account row action buttons from 36px to a 44×44 touch target on desktop, folded them into a `RowActions` kebab below `sm`, and gave the two modal close buttons the same floor.

### Removed
- **Roster Card/Table Toggle**: Removed the `Tampilan Kartu` / `Tampilan Tabel` switch and the `mobileViewMode` state in `EventDetailPage`; `Table` is now confined to the RBAC matrix, the audit log, and the import preview.
- **Dead CSS Utilities**: Removed unused `.display`, `.reveal-up`, `@keyframes reveal-up`, `.pt-safe`, `.content-auto` from `src/client/index.css`, and removed unused `reveal-up` animation from `tailwind.config.js`.

## [1.3.0] - 2026-03-31

### Added
- **Candidate Member Lifecycle**: Extended member status domain model with `candidate` and `archived` states (`src/shared/types/index.ts`, `src/db/schema.sql`, `0008_candidate_lifecycle_and_status.sql`).
- **D1 Status Check Constraint Migration**: Added `0009_expand_member_status_check_constraint.sql` table recreation migration to expand SQLite/D1 status CHECK constraint to `('active', 'inactive', 'candidate', 'archived')`.
- **Candidate Induction & Sweeping**: Added atomic batch candidate induction endpoint `POST /api/members/candidates/induct` supporting optional sweeping of unselected candidates to `archived` status with audit trail.
- **Archive Management & Purge**: Added batch archive (`POST /api/members/candidates/archive`), restore (`POST /api/members/candidates/restore`), and cascading permanent purge (`POST /api/members/candidates/purge`) endpoints.
- **Candidate Attendance & Activity Tracking**: Updated attendance engine to allow candidate member QR scanning and manual checkin while blocking archived members, and added status filtering support (`status: candidate | active | archived | all`) to member activity tracker endpoints.

### Changed
- **Harmonized Members Page UI/UX**: Unified `PageHeader` action buttons (`Tambah Anggota/Calon`, `Impor`, `Ekspor CSV`, `Cetak Semua Badge`) per active tab, added symmetric 3-card KPI summaries on `Anggota Resmi` and `Calon Anggota & Pelantikan` tabs with live status badges, streamlined `CandidateWorkspace` sub-tab toolbar, and improved dynamic dialog headings in `MemberFormModal`.
## [1.2.0] - 2026-03-30

### Security & Hardening (Strix Pentest Remediation)
- **Multi-Key Rate Limiting (vuln-0001)**: Implemented dual-key (IP + account identifier) sliding window rate limiter to mitigate distributed password guessing and credential stuffing.
- **Cryptographic Upgrades (vuln-0002)**: Upgraded PBKDF2 password hashing to 100,000 iterations (Cloudflare Workers platform maximum) with automatic transparent upgrade for legacy hashes on login.
- **Session Revocation (vuln-0003, vuln-0014)**: Added server-side token revocation registry on logout and immediate token invalidation on admin account deactivation or password change.
- **Re-Authentication (vuln-0004)**: Enforced mandatory `current_password` verification before executing profile email changes.
- **Strict CORS & CSRF Defense (vuln-0005, vuln-0011, vuln-0017)**: Restricted loopback origins to standard development ports (`5173`, `8787`, `5175`, `4173`, `3000`), added server-side CSRF validation for cookie-authenticated mutating requests, and enforced strict `Content-Type: application/json`.
- **Role-Based Access Control & IDOR Defense (vuln-0006, vuln-0007, vuln-0016)**: Added role gating on universal QR token generation (`owner` and `admin`), enforced self-ownership on single member QR retrieval, hardened QR login against revoked passes, and sanitized admin emails/metadata in audit logs for `auditor` role.
- **Account Existence Oracle Mitigation (vuln-0008)**: Unified all authentication failure messages to constant-time responses with identical 401 error payloads and dummy cryptographic verification.
- **Data & Storage Integrity (vuln-0009, vuln-0010, vuln-0013, vuln-0015)**: Accurate bulk deletion count reporting using D1 `meta.changes`, added `json_valid` SQLite query guards preventing malformed JSON exceptions, enforced event `session_modes` during attendance scanning, and enforced member email uniqueness.
- **Client Cache Isolation (vuln-0012)**: Excluded authentication routes from Service Worker CacheStorage and implemented full client cache purging on logout.

### Automated Tests & Documentation
- Added comprehensive end-to-end regression test suite `tests/strix-pentest-remediation.test.ts` covering all 17 security vulnerabilities.
- Added enterprise security specification and threat model in `docs/SECURITY.md`.
