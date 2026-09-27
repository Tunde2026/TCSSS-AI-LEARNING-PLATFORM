-- ============================================================
-- 030_announcements.sql
-- Admin announcements / news / updates system.
-- Two display modes: modal (countdown-gated close) and inline
-- banner (countdown-gated close). Admin sets dismiss delay,
-- cooldown after dismissal, optional CTA button, scheduling,
-- and targeting.
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  body                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'announcement',
  priority              TEXT NOT NULL DEFAULT 'normal',
  display_mode          TEXT NOT NULL DEFAULT 'inline',
  modal_delay_seconds   INTEGER NOT NULL DEFAULT 30,
  inline_delay_seconds  INTEGER NOT NULL DEFAULT 15,
  cooldown_hours        INTEGER NOT NULL DEFAULT 24,
  action_label          TEXT,
  action_url            TEXT,
  action_style          TEXT DEFAULT 'primary',
  action_new_tab        BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at             TIMESTAMPTZ DEFAULT now(),
  expires_at            TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  target_role           TEXT NOT NULL DEFAULT 'all',
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS announcement_dismissals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dismissed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON announcements(is_active, starts_at, expires_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_announcement_dismissals_user
  ON announcement_dismissals(user_id);
