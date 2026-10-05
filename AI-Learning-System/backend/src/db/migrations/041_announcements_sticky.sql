
-- ============================================================
-- 041_announcements_sticky.sql
-- Adds "sticky" flag. When TRUE, the announcement always
-- shows on every visit — dismissals are ignored.
-- ============================================================

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS sticky BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_announcements_sticky
  ON announcements(sticky, is_active, deleted_at)
  WHERE sticky = TRUE;
