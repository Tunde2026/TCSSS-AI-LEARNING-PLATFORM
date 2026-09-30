-- ============================================================
-- 034_achievements_v2.sql
-- Extends the badge system:
--   - track completion time
--   - track duration (time from first attempt to completion)
--   - allow reset and re-earn
--   - keep permanent history of every completion
-- ============================================================

-- New columns on user_badges
ALTER TABLE user_badges
  ADD COLUMN IF NOT EXISTS started_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_seconds   INTEGER,
  ADD COLUMN IF NOT EXISTS reset_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_data      JSONB DEFAULT '{}'::jsonb;

-- Permanent completion history (survives resets)
CREATE TABLE IF NOT EXISTS user_badge_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key        TEXT NOT NULL,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER,
  reset_round      INTEGER,
  metadata         JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_badge_history_user
  ON user_badge_history(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_badge_history_key
  ON user_badge_history(badge_key);
