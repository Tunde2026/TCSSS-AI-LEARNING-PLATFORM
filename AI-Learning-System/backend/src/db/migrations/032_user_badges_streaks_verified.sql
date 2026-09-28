-- ============================================================
-- 032_user_badges_streaks_verified.sql
-- User badge catalog, daily streaks, activity log, and a
-- "verified" flag for trusted/protected accounts.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key   TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata    JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON user_badges(user_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak     INTEGER NOT NULL DEFAULT 0,
  longest_streak     INTEGER NOT NULL DEFAULT 0,
  total_active_days  INTEGER NOT NULL DEFAULT 0,
  last_active_date   DATE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_activity_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type  TEXT NOT NULL DEFAULT 'session',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_date
  ON user_activity_log(user_id, activity_date);

CREATE INDEX IF NOT EXISTS idx_activity_log_date
  ON user_activity_log(activity_date);

-- ------------------------------------------------------------
-- Protect and verify the lead admin account.
-- Change the email below if the owner's email ever changes.
-- ------------------------------------------------------------
UPDATE users
   SET is_protected = TRUE,
       verified     = TRUE
 WHERE email = 'aduraemmanuel123@gmail.com';
