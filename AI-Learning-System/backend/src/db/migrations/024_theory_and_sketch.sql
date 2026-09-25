-- ============================================================
-- 024_theory_and_sketch.sql
-- ------------------------------------------------------------
-- Theory (fill-in-the-gap) questions + attempts
-- Sketch (formula/scientific notation) saved formulas
-- ============================================================

-- ---------- 1. Theory: fill-in-the-gap questions ----------
CREATE TABLE IF NOT EXISTS theory_sets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  subject         text,
  topic           text,
  difficulty      text NOT NULL DEFAULT 'medium',
  source_type     text NOT NULL DEFAULT 'manual',
  ai_generated    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS theory_sets_user_idx  ON theory_sets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS theory_sets_topic_idx ON theory_sets(topic);

CREATE TABLE IF NOT EXISTS theory_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id            uuid NOT NULL REFERENCES theory_sets(id) ON DELETE CASCADE,
  position          integer NOT NULL DEFAULT 0,
  template          text NOT NULL,
  accepted_answers  jsonb NOT NULL DEFAULT '[]',
  hint              text,
  explanation       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS theory_questions_set_idx ON theory_questions(set_id, position);

CREATE TABLE IF NOT EXISTS theory_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id          uuid NOT NULL REFERENCES theory_sets(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score           integer NOT NULL DEFAULT 0,
  total           integer NOT NULL DEFAULT 0,
  answers         jsonb NOT NULL DEFAULT '[]',
  time_taken_seconds integer,
  completed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS theory_attempts_user_idx ON theory_attempts(user_id, completed_at DESC);

-- ---------- 2. Sketch: saved formulas ----------
CREATE TABLE IF NOT EXISTS sketches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text,
  subject         text,
  raw_input       text NOT NULL,
  rendered_html   text NOT NULL,
  rendered_text   text,
  kind            text DEFAULT 'formula',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sketches_user_idx    ON sketches(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sketches_subject_idx ON sketches(subject);