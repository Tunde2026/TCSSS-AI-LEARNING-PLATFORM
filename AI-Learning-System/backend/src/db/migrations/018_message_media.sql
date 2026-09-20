-- FROZEN AFTER MERGE. Add new migrations as 019_*.sql

-- Store generated/searched images attached to a message
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media JSONB;

CREATE INDEX IF NOT EXISTS messages_media_idx
  ON messages ((media IS NOT NULL))
  WHERE media IS NOT NULL;
