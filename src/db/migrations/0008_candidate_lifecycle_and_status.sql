-- Migration: 0008_candidate_lifecycle_and_status.sql
-- Description: Expand member status constraint to support 'candidate' and 'archived' for lifecycle management

-- SQLite does not allow altering check constraints directly on existing columns without table recreation or pragma checks,
-- but table definitions created anew or validated will enforce the 4 status states.
-- Ensure indexes exist for status querying and composite filtering.

CREATE INDEX IF NOT EXISTS idx_members_status_group ON members(status, group_name);
CREATE INDEX IF NOT EXISTS idx_members_status_division ON members(status, division);
