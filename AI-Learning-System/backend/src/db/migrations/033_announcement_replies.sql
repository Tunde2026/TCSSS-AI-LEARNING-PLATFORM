-- ============================================================
-- 033_announcement_replies.sql
-- Students can reply to an announcement. Admin sees them in
-- a dedicated inbox with read/archive state.
-- ============================================================

CREATE TABLE IF NOT EXISTS announcement_replies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  admin_read       BOOLEAN NOT NULL DEFAULT FALSE,
  admin_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcement_replies_ann
  ON announcement_replies(announcement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_replies_unread
  ON announcement_replies(admin_read, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_announcement_replies_user
  ON announcement_replies(user_id, created_at DESC);
