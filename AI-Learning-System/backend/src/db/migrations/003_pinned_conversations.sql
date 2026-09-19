-- FROZEN AFTER MERGE. Add new migrations as 004_*.sql
-- Adds a pinned flag so users can keep important conversations at the top.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS conversations_pinned_idx
  ON conversations (user_id, pinned DESC, updated_at DESC);