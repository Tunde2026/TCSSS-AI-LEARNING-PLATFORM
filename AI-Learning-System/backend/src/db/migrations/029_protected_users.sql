-- ============================================================
-- 029_protected_users.sql
-- ------------------------------------------------------------
-- Adds a "protected" flag to users. Protected accounts cannot
-- be suspended, deleted, demoted, or have their password reset
-- by any other admin. This is intended for the primary owner /
-- super-admin account.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_protected_idx
  ON users(is_protected)
  WHERE is_protected = true;

-- Mark the primary owner account as protected.
-- Safe to re-run — the WHERE clause makes it idempotent.
UPDATE users
   SET is_protected = true
 WHERE email = 'aduraemmanuel123@gmail.com';