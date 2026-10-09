-- Migration: 0009_expand_member_status_check_constraint.sql
-- Description: Recreate members table to expand status CHECK constraint to ('active','inactive','candidate','archived')

PRAGMA defer_foreign_keys = ON;
PRAGMA legacy_alter_table = ON;

CREATE TABLE IF NOT EXISTS members_new (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  group_name TEXT,
  division TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','candidate','archived')),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO members_new (id, external_id, name, email, phone, group_name, division, status, metadata, created_at, updated_at)
SELECT id, external_id, name, email, phone, group_name, division, status, metadata, created_at, updated_at FROM members;

DROP TABLE members;

ALTER TABLE members_new RENAME TO members;

CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_name);
CREATE INDEX IF NOT EXISTS idx_members_division ON members(division);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_status_group ON members(status, group_name);
CREATE INDEX IF NOT EXISTS idx_members_status_division ON members(status, division);

PRAGMA legacy_alter_table = OFF;
PRAGMA defer_foreign_keys = OFF;
