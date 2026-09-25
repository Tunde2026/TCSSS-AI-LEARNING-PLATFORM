-- ============================================================
-- 025_add_descriptions.sql
-- ------------------------------------------------------------
-- Adds an optional "description" field to each tool's main
-- table so students can note what a set is for / how they feel.
-- Safe to re-run.
-- ============================================================

ALTER TABLE quizzes          ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE flashcard_decks  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE theory_sets      ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE practice_sets    ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE study_plans      ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE sketches         ADD COLUMN IF NOT EXISTS description text;