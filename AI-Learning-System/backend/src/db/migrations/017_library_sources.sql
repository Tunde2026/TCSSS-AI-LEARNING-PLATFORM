-- FROZEN AFTER MERGE. Add new migrations as 018_*.sql

CREATE TABLE IF NOT EXISTS library_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  source_type    TEXT NOT NULL,           -- 'gutenberg'
  query          TEXT,                    -- search term
  subject        TEXT,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  max_items      INTEGER NOT NULL DEFAULT 30,
  last_synced_at TIMESTAMPTZ,
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track external IDs so we don't re-import
ALTER TABLE library_documents
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS library_documents_external_idx
  ON library_documents (external_id) WHERE external_id IS NOT NULL;

-- Seed sensible defaults
INSERT INTO library_sources (name, source_type, query, subject, max_items) VALUES
  ('Gutenberg — Physics',    'gutenberg', 'physics',     'Physics',     25),
  ('Gutenberg — Chemistry',  'gutenberg', 'chemistry',   'Chemistry',   25),
  ('Gutenberg — Biology',    'gutenberg', 'biology',     'Biology',     25),
  ('Gutenberg — Mathematics','gutenberg', 'mathematics', 'Mathematics', 25),
  ('Gutenberg — History',    'gutenberg', 'history',     'History',     20)
ON CONFLICT DO NOTHING;