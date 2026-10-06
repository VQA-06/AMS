# Changelog

All notable changes to the Attendance Management System (AMS) are documented in this file.

## [1.2.0] - 2026-03-30

### Security & Hardening (Strix Pentest Remediation)
- **Multi-Key Rate Limiting (vuln-0001)**: Implemented dual-key (IP + account identifier) sliding window rate limiter to mitigate distributed password guessing and credential stuffing.
- **Cryptographic Upgrades (vuln-0002)**: Upgraded PBKDF2 password hashing to 600,000 iterations with automatic transparent upgrade for legacy hashes on login.
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
