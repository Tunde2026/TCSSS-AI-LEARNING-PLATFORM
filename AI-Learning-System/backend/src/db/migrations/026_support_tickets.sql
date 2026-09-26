-- ============================================================
-- 026_support_tickets.sql
-- ------------------------------------------------------------
-- Support system: students submit tickets, admins reply.
-- Two tables:
--   support_tickets  — one row per issue
--   support_messages — the full thread inside a ticket
--
-- Categories: bug | feature | question | bullying | other
-- Statuses:   open | in_progress | resolved | closed
-- Sender:     student | admin | system
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  email           text NOT NULL,
  whatsapp        text NOT NULL,
  category        text NOT NULL DEFAULT 'question',
  subject         text NOT NULL,
  status          text NOT NULL DEFAULT 'open',
  priority        text NOT NULL DEFAULT 'normal',
  -- priority: normal | high (bullying auto-escalates)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx     ON support_tickets(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx   ON support_tickets(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_category_idx ON support_tickets(category);
CREATE INDEX IF NOT EXISTS support_tickets_priority_idx ON support_tickets(priority, last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type     text NOT NULL,      -- student | admin | system
  sender_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  sender_name     text,
  body            text NOT NULL,
  read_by_student boolean NOT NULL DEFAULT false,
  read_by_admin   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS support_messages_unread_admin_idx
  ON support_messages(ticket_id) WHERE read_by_admin = false AND sender_type = 'student';
CREATE INDEX IF NOT EXISTS support_messages_unread_student_idx
  ON support_messages(ticket_id) WHERE read_by_student = false AND sender_type = 'admin';