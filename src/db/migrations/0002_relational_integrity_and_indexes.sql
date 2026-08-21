-- ==============================================================================
-- MIGRATION 0002: Relational Integrity, Foreign Keys & Cloudflare D1 Index Optimizations
-- ==============================================================================

-- Enable Foreign Key enforcement in SQLite / D1
PRAGMA foreign_keys = ON;

-- 1. Index Optimizations for EVENTS (prevents Full Table Scans on D1 free tier)
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);

-- 2. Index Optimizations for MEMBERS
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
CREATE INDEX IF NOT EXISTS idx_members_status_division ON members(status, division);

-- 3. Composite & Performance Indexes for ATTENDANCES (crucial for live stats & tracker)
CREATE INDEX IF NOT EXISTS idx_attendances_event_session ON attendances(event_id, session_type);
CREATE INDEX IF NOT EXISTS idx_attendances_member_scanned ON attendances(member_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_attendances_qr_token ON attendances(qr_token_id);

-- 4. Performance Indexes for QR TOKENS
CREATE INDEX IF NOT EXISTS idx_qr_tokens_member_scope ON qr_tokens(member_id, scope);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_validity ON qr_tokens(revoked_at, expires_at);

-- 5. Audit & Log Index
CREATE INDEX IF NOT EXISTS idx_scan_attempts_jti ON scan_attempts(token_jti);
