-- FROZEN AFTER MERGE. Add new migrations as 016_*.sql

CREATE TABLE IF NOT EXISTS study_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  topic         TEXT NOT NULL,
  subject       TEXT,
  duration_days INTEGER NOT NULL DEFAULT 7,
  start_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  plan          JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_plans_user_idx
  ON study_plans (user_id, created_at DESC);

-- Exam mode flags
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS is_exam BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS is_exam BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER;