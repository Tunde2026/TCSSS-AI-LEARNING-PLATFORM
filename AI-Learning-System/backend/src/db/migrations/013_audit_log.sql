-- FROZEN AFTER MERGE. Add new migrations as 014_*.sql

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_email  TEXT,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  target_label TEXT,
  details      JSONB,
  ip           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx
  ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_admin_idx
  ON audit_log (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON audit_log (action, created_at DESC);