-- FROZEN AFTER MERGE. Add new migrations as 012_*.sql

-- Logo URL setting
INSERT INTO system_settings (key, value, type, description, category) VALUES
  ('platform.logo_url', '""', 'string', 'Path to the platform logo image', 'general')
ON CONFLICT (key) DO NOTHING;

-- Mark manual knowledge entries (they have no uploaded file)
ALTER TABLE library_documents
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'upload';

CREATE INDEX IF NOT EXISTS library_documents_source_idx
  ON library_documents (source_type);