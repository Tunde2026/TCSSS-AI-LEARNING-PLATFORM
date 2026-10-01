
-- ============================================================
-- 039_dm_folders_media.sql
-- Chat folders + media (for AI-generated tool widgets).
-- ============================================================

CREATE TABLE IF NOT EXISTS dm_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'fa-folder',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_folders_user
  ON dm_folders(user_id, position ASC);

ALTER TABLE direct_conversation_members
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES dm_folders(id) ON DELETE SET NULL;

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS media JSONB;
