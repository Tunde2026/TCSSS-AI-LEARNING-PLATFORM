CREATE TABLE IF NOT EXISTS library_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by    UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  subject        TEXT,
  level          TEXT,
  author         TEXT,
  filename       TEXT NOT NULL,
  original_name  TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     BIGINT NOT NULL,
  storage_path   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  approved       BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at    TIMESTAMPTZ,
  approved_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS library_documents_approved_idx
  ON library_documents (approved, uploaded_at DESC);