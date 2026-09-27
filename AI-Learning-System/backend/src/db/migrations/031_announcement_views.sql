-- ============================================================
-- 031_announcement_views.sql
-- Tracks who has seen each announcement and when. One row per
-- (announcement, user). Counters updated on every view.
-- ============================================================

CREATE TABLE IF NOT EXISTS announcement_views (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  view_count       INTEGER NOT NULL DEFAULT 1,
  display_mode     TEXT,
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_views_ann
  ON announcement_views(announcement_id, last_viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_views_user
  ON announcement_views(user_id, last_viewed_at DESC);
