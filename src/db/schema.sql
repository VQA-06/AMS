-- ==============================================================================
-- AMS (Attendance Management System) - SQLite / Cloudflare D1 Full Database Schema
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- =====================================
-- ADMINS
-- =====================================
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','operator','auditor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admins_member_id ON admins(member_id);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);

-- =====================================
-- MEMBERS (with optional division)
-- =====================================
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  group_name TEXT,
  division TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_name);
CREATE INDEX IF NOT EXISTS idx_members_division ON members(division);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
CREATE INDEX IF NOT EXISTS idx_members_status_division ON members(status, division);

-- =====================================
-- EVENTS
-- =====================================
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location_name TEXT,
  starts_at TEXT,
  ends_at TEXT,
  qr_policy TEXT NOT NULL DEFAULT 'event_only' CHECK(qr_policy IN ('event_only','universal_allowed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed','archived')),
  session_modes TEXT NOT NULL DEFAULT '["CHECKIN"]',
  allow_manual_attendance INTEGER NOT NULL DEFAULT 0,
  grace_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);

-- =====================================
-- QR TOKENS
-- =====================================
CREATE TABLE IF NOT EXISTS qr_tokens (
  id TEXT PRIMARY KEY,
  jti TEXT NOT NULL UNIQUE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK(scope IN ('universal','event')),
  valid_from TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (scope = 'event' AND event_id IS NOT NULL)
    OR
    (scope = 'universal' AND event_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_member ON qr_tokens(member_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_event ON qr_tokens(event_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_jti ON qr_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_member_scope ON qr_tokens(member_id, scope);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_validity ON qr_tokens(revoked_at, expires_at);

-- =====================================
-- ATTENDANCES
-- =====================================
CREATE TABLE IF NOT EXISTS attendances (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  qr_token_id TEXT NOT NULL REFERENCES qr_tokens(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'CHECKIN',
  scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
  station_id TEXT,
  operator_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  is_manual INTEGER NOT NULL DEFAULT 0,
  meta TEXT NOT NULL DEFAULT '{}'
);

-- Prevent duplicate attendance per event + member + session_type
CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_unique
ON attendances(event_id, member_id, session_type);

CREATE INDEX IF NOT EXISTS idx_attendance_event ON attendances(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendances(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_scanned_at ON attendances(scanned_at);
CREATE INDEX IF NOT EXISTS idx_attendances_event_session ON attendances(event_id, session_type);
CREATE INDEX IF NOT EXISTS idx_attendances_member_scanned ON attendances(member_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_attendances_qr_token ON attendances(qr_token_id);

-- =====================================
-- SCAN ATTEMPTS (audit scan logs)
-- =====================================
CREATE TABLE IF NOT EXISTS scan_attempts (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  token_jti TEXT,
  member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK(result IN ('success','failed')),
  reason TEXT,
  station_id TEXT,
  operator_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_attempts_event ON scan_attempts(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_attempts_created ON scan_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_attempts_jti ON scan_attempts(token_jti);

-- =====================================
-- IMPORT JOBS
-- =====================================
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL DEFAULT 'member',
  format TEXT NOT NULL CHECK(format IN ('csv','json')),
  file_name TEXT,
  r2_key TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('create','update','upsert')),
  status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','failed')),
  stats TEXT NOT NULL DEFAULT '{}',
  error_report_key TEXT,
  created_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

-- =====================================
-- AUDIT LOGS
-- =====================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
