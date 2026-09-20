-- FROZEN AFTER MERGE. Add new migrations as 017_*.sql

CREATE TABLE IF NOT EXISTS chat_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id      UUID REFERENCES messages(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  storage_path    TEXT NOT NULL,
  extracted_text  TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extraction_error  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_attachments_user_idx
  ON chat_attachments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_attachments_conversation_idx
  ON chat_attachments (conversation_id);