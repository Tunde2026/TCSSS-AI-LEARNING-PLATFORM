-- FROZEN AFTER MERGE. Add new migrations as 006_*.sql

CREATE TABLE IF NOT EXISTS custom_agents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  system_prompt     TEXT NOT NULL,
  subject           TEXT,
  level             TEXT,
  learning_style    TEXT,
  allowed_tools     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS custom_agents_user_idx
  ON custom_agents (user_id, created_at DESC);