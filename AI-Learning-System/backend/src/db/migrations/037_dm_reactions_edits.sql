-- ============================================================
-- 037_dm_reactions_edits.sql
-- Adds: message edits, soft-delete, reply-to, emoji reactions.
-- ============================================================

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS edited_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_to_id   UUID;

CREATE TABLE IF NOT EXISTS direct_message_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_dmr_message ON direct_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_dm_reply   ON direct_messages(reply_to_id);
