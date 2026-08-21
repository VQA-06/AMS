-- Migration: Seed default permanent Owner record in admins table
INSERT OR REPLACE INTO admins (id, email, name, role, status, password_hash, created_at, updated_at)
VALUES (
  'adm_owner_default',
  'owner@ams.cc',
  'Owner AMS',
  'owner',
  'active',
  NULL,
  datetime('now'),
  datetime('now')
);
