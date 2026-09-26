-- ============================================================
-- 028_support_folders.sql
-- ------------------------------------------------------------
-- Admin-side organization of support tickets.
--   - Whole-ticket read/unread flag for admins
--   - Admin-assigned folder (inbox | urgent | later | archive | custom)
--   - support_admin_folders table for custom folders
-- ============================================================

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS admin_read boolean NOT NULL DEFAULT false;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS admin_folder text NOT NULL DEFAULT 'inbox';

CREATE INDEX IF NOT EXISTS support_tickets_folder_idx
  ON support_tickets(admin_folder, last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_admin_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  icon       text NOT NULL DEFAULT 'fa-folder',
  position   integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default folders
INSERT INTO support_admin_folders (name, icon, position)
SELECT 'inbox',   'fa-inbox',      1
WHERE NOT EXISTS (SELECT 1 FROM support_admin_folders WHERE name = 'inbox');

INSERT INTO support_admin_folders (name, icon, position)
SELECT 'urgent',  'fa-fire',       2
WHERE NOT EXISTS (SELECT 1 FROM support_admin_folders WHERE name = 'urgent');

INSERT INTO support_admin_folders (name, icon, position)
SELECT 'later',   'fa-clock',      3
WHERE NOT EXISTS (SELECT 1 FROM support_admin_folders WHERE name = 'later');

INSERT INTO support_admin_folders (name, icon, position)
SELECT 'archive', 'fa-box-archive', 4
WHERE NOT EXISTS (SELECT 1 FROM support_admin_folders WHERE name = 'archive');