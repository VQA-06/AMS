-- ==============================================================================
-- MIGRATION 0006: Relational Integrity, Foreign Key Indexes & Composite Indexes
-- ==============================================================================

-- Enable Foreign Key enforcement in SQLite / D1
PRAGMA foreign_keys = ON;

-- 1. Composite & Query Performance Index for Member Activity & Recap Matrix
-- Accelerates LEFT JOIN attendances a ON m.id = a.member_id AND a.session_type = 'CHECKIN'
CREATE INDEX IF NOT EXISTS idx_attendances_member_session ON attendances(member_id, session_type);

-- 2. Referencing Foreign Key Indexes (Eliminates full table scans on cascading parent deletes)
CREATE INDEX IF NOT EXISTS idx_scan_attempts_member ON scan_attempts(member_id);
CREATE INDEX IF NOT EXISTS idx_attendances_operator ON attendances(operator_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_created_by ON qr_tokens(created_by);
