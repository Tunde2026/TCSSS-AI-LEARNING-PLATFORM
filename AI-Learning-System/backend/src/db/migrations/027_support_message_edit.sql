-- ============================================================
-- 027_support_message_edit.sql
-- ------------------------------------------------------------
-- Adds soft-delete and edit tracking to support messages.
-- Rows are never hard-deleted — deleted_at marks them so the
-- thread stays coherent (both parties see "[message deleted]").
-- ============================================================

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS support_messages_active_idx
  ON support_messages(ticket_id)
  WHERE deleted_at IS NULL;