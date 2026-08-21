-- Migration: Add member_id column and index to admins table
ALTER TABLE admins ADD COLUMN member_id TEXT REFERENCES members(id);
CREATE INDEX IF NOT EXISTS idx_admins_member_id ON admins(member_id);
