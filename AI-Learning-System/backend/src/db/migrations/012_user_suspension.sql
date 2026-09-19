-- FROZEN AFTER MERGE. Add new migrations as 013_*.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

CREATE INDEX IF NOT EXISTS users_suspended_idx
  ON users (suspended);