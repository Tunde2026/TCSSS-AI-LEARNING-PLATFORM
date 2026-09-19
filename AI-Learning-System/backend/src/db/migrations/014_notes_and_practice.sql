-- FROZEN AFTER MERGE. Add new migrations as 015_*.sql

-- ---------- Notes ----------
CREATE TABLE IF NOT EXISTS notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Untitled note',
  content    TEXT NOT NULL DEFAULT '',
  subject    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_user_idx
  ON notes (user_id, updated_at DESC);

-- Full-text search on title + content
CREATE INDEX IF NOT EXISTS notes_search_idx
  ON notes USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));

-- ---------- Practice sets ----------
CREATE TABLE IF NOT EXISTS practice_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  topic       TEXT NOT NULL,
  subject     TEXT,
  difficulty  TEXT NOT NULL DEFAULT 'medium',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_sets_user_idx
  ON practice_sets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS practice_questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id     UUID NOT NULL REFERENCES practice_sets(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  hint       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_questions_set_idx
  ON practice_questions (set_id, position);