ALTER TABLE direct_conversation_members
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_dcm_pinned
  ON direct_conversation_members(user_id, pinned, joined_at DESC);
