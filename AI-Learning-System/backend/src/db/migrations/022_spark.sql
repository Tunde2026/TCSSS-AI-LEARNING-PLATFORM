-- ============================================================
-- 022_spark.sql
-- ------------------------------------------------------------
-- Spark "Discover Your Potential" — adaptive academic-direction
-- assessment.
--
-- Five tables:
--   spark_question_bank    — catalog of all questions
--   spark_assessments      — one row per student attempt
--   spark_responses        — every question the student answered
--   spark_skill_scores     — computed per-skill evidence
--   spark_recommendations  — computed stream alignment + reasons
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS, every seed
-- INSERT uses ON CONFLICT DO NOTHING.
-- ============================================================

-- ---------- 1. Question bank ----------
CREATE TABLE IF NOT EXISTS spark_question_bank (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL,
  skill           text NOT NULL,
  difficulty      text NOT NULL DEFAULT 'medium',
  answer_type     text NOT NULL,
  question_text   text NOT NULL,
  options         jsonb,
  correct_answer  jsonb,
  explanation     text,
  scoring_config  jsonb,
  target_streams  text[] DEFAULT '{}',
  age_min         integer,
  age_max         integer,
  active          boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spark_qb_category_idx ON spark_question_bank(category);
CREATE INDEX IF NOT EXISTS spark_qb_skill_idx    ON spark_question_bank(skill);
CREATE INDEX IF NOT EXISTS spark_qb_active_idx   ON spark_question_bank(active);

-- ---------- 2. Assessments ----------
CREATE TABLE IF NOT EXISTS spark_assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'in_progress',
  version         integer NOT NULL DEFAULT 1,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  profile         jsonb,
  meta            jsonb
);

CREATE INDEX IF NOT EXISTS spark_assessments_user_idx
  ON spark_assessments(user_id, started_at DESC);

-- ---------- 3. Responses ----------
CREATE TABLE IF NOT EXISTS spark_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES spark_assessments(id) ON DELETE CASCADE,
  question_id       uuid REFERENCES spark_question_bank(id) ON DELETE SET NULL,
  question_snapshot jsonb NOT NULL,
  response          jsonb NOT NULL,
  correctness       boolean,
  score             numeric(5,4),
  skill             text NOT NULL,
  response_time_ms  integer,
  ai_analysis       jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spark_responses_assessment_idx ON spark_responses(assessment_id);
CREATE INDEX IF NOT EXISTS spark_responses_skill_idx      ON spark_responses(skill);

-- ---------- 4. Skill scores (per assessment) ----------
CREATE TABLE IF NOT EXISTS spark_skill_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid NOT NULL REFERENCES spark_assessments(id) ON DELETE CASCADE,
  skill           text NOT NULL,
  score           numeric(5,4) NOT NULL,
  confidence      numeric(5,4) NOT NULL,
  evidence_count  integer NOT NULL DEFAULT 0,
  trend           text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, skill)
);

-- ---------- 5. Recommendations (per assessment, per stream) ----------
CREATE TABLE IF NOT EXISTS spark_recommendations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES spark_assessments(id) ON DELETE CASCADE,
  stream            text NOT NULL,
  alignment         text NOT NULL,
  confidence        numeric(5,4) NOT NULL,
  reasons           jsonb NOT NULL DEFAULT '[]',
  development_areas jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, stream)
);

-- ---------- 6. Seed default scoring config ----------
-- Admin can tune later by updating this row — no code change needed.
INSERT INTO system_settings (key, value, type, category, description)
VALUES (
  'spark.scoring',
  '{
    "performance_weight":     1.0,
    "reasoning_weight":       1.0,
    "interest_weight":        0.4,
    "scenario_weight":        0.5,
    "self_report_weight":     0.2,
    "confidence_floor":       0.15,
    "min_evidence_per_skill": 2
  }'::jsonb,
  'json',
  'spark',
  'Spark scoring weights and thresholds'
)
ON CONFLICT (key) DO NOTHING;