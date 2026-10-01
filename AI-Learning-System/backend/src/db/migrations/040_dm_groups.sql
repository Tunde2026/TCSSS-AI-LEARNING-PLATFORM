
-- ============================================================
-- 040_dm_groups.sql
-- Group chats: name, creator, avatar emoji, member roles.
-- ============================================================

ALTER TABLE direct_conversations
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avatar_emoji TEXT;

ALTER TABLE direct_conversation_members
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_dc_groups
  ON direct_conversations(is_group, last_message_at DESC)
  WHERE is_group = TRUE;
