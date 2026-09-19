-- FROZEN AFTER MERGE. Add new migrations as 011_*.sql

CREATE TABLE IF NOT EXISTS provider_credentials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL,
  label        TEXT,
  key_value    TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_credentials_provider_idx
  ON provider_credentials (provider, enabled);