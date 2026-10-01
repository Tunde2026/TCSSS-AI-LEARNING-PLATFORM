-- ============================================================
-- 036_direct_messages.sql
-- Student-to-student direct messaging with optional @ai
-- mention that triggers an AI response visible to everyone
-- in the conversation.
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT,
  is_group         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS direct_conversation_members (
  conversation_id  UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dcm_user
  ON direct_conversation_members(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS direct_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  author_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  body             TEXT NOT NULL,
  is_ai            BOOLEAN NOT NULL DEFAULT FALSE,
  ai_provider      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_conversation
  ON direct_messages(conversation_id, created_at ASC);
