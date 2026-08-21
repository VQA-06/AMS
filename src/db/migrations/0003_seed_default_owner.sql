-- Migration: Seed default permanent Owner record in admins table
INSERT OR REPLACE INTO admins (id, email, name, role, status, password_hash, created_at, updated_at)
VALUES (
  'adm_owner_default',
  'owner@ams.cc',
  'Owner AMS',
  'owner',
  'active',
  '0563bd2c429b5e282dbadf3ed2d526bc:7eca3d71e4192ee2a16cf7bb376f6e2eb7bd443c90449687c69f17c02e72843d',
  datetime('now'),
  datetime('now')
);
