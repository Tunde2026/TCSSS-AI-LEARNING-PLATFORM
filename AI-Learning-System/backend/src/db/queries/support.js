// ============================================================
// db/queries/support.js
// ------------------------------------------------------------
// Data access for the Support system.
//
// Two tables:
//   support_tickets   — one row per issue
//   support_messages  — the thread inside a ticket
// ============================================================

const { pool } = require('../pool');

const VALID_CATEGORIES = ['bug', 'feature', 'question', 'bullying', 'other'];
const VALID_STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];

/* ============================================================
   TICKETS
   ============================================================ */

async function createTicket(input) {
  const {
    userId, name, email, whatsapp,
    category, subject,
  } = input;

  // Bullying auto-escalates to high priority.
  const priority = category === 'bullying' ? 'high' : 'normal';

  const { rows } = await pool.query(
    `INSERT INTO support_tickets
       (user_id, name, email, whatsapp, category, subject, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId || null, name, email, whatsapp, category, subject, priority]
  );
  return rows[0];
}

async function findTicketById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM support_tickets WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function listTicketsForUser(userId, { limit = 50 } = {}) {
  const { rows } = await pool.query(
    `SELECT t.*,
            (SELECT COUNT(*)::int FROM support_messages m
              WHERE m.ticket_id = t.id
                AND m.sender_type = 'admin'
                AND m.read_by_student = false) AS unread_for_student,
            (SELECT COUNT(*)::int FROM support_messages m
              WHERE m.ticket_id = t.id) AS message_count
       FROM support_tickets t
      WHERE t.user_id = $1
      ORDER BY t.last_message_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function listAllTickets({ status, category, priority, folder, q, limit = 200 } = {}) {
  const clauses = [];
  const params = [];

  if (status)   { params.push(status);   clauses.push('t.status = $' + params.length); }
  if (category) { params.push(category); clauses.push('t.category = $' + params.length); }
  if (priority) { params.push(priority); clauses.push('t.priority = $' + params.length); }
  if (folder)   { params.push(folder);   clauses.push('t.admin_folder = $' + params.length); }
  if (q) {
    params.push('%' + q + '%');
    clauses.push('(t.subject ILIKE $' + params.length +
                 ' OR t.name ILIKE $' + params.length +
                 ' OR t.email ILIKE $' + params.length + ')');
  }

  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT t.*,
            (SELECT COUNT(*)::int FROM support_messages m
              WHERE m.ticket_id = t.id
                AND m.sender_type = 'student'
                AND m.read_by_admin = false) AS unread_for_admin,
            (SELECT COUNT(*)::int FROM support_messages m
              WHERE m.ticket_id = t.id) AS message_count
       FROM support_tickets t
       ${where}
      ORDER BY
        CASE t.priority WHEN 'high' THEN 0 ELSE 1 END,
        t.last_message_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function updateTicketStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE support_tickets
        SET status = $1, updated_at = now()
      WHERE id = $2
      RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
}

async function touchTicket(id) {
  await pool.query(
    `UPDATE support_tickets SET last_message_at = now(), updated_at = now() WHERE id = $1`,
    [id]
  );
}

/* ============================================================
   MESSAGES
   ============================================================ */

async function addMessage(input) {
  const {
    ticketId, senderType, senderId = null,
    senderName = null, body,
    readByStudent = false,
    readByAdmin = false,
  } = input;

  const { rows } = await pool.query(
    `INSERT INTO support_messages
       (ticket_id, sender_type, sender_id, sender_name, body,
        read_by_student, read_by_admin)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [ticketId, senderType, senderId, senderName, body, readByStudent, readByAdmin]
  );
  return rows[0];
}

async function listMessagesForTicket(ticketId) {
  const { rows } = await pool.query(
    `SELECT * FROM support_messages
      WHERE ticket_id = $1
      ORDER BY created_at ASC`,
    [ticketId]
  );
  return rows;
}

async function markMessagesReadByStudent(ticketId) {
  const { rowCount } = await pool.query(
    `UPDATE support_messages
        SET read_by_student = true
      WHERE ticket_id = $1
        AND sender_type = 'admin'
        AND read_by_student = false`,
    [ticketId]
  );
  return rowCount;
}

async function markMessagesReadByAdmin(ticketId) {
  const { rowCount } = await pool.query(
    `UPDATE support_messages
        SET read_by_admin = true
      WHERE ticket_id = $1
        AND sender_type = 'student'
        AND read_by_admin = false`,
    [ticketId]
  );
  return rowCount;
}

/* ============================================================
   UNREAD COUNTS (used for badges)
   ============================================================ */

async function countUnreadForUser(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM support_messages m
       JOIN support_tickets t ON t.id = m.ticket_id
      WHERE t.user_id = $1
        AND m.sender_type = 'admin'
        AND m.read_by_student = false`,
    [userId]
  );
  return rows[0].n;
}

async function countUnreadForAdmin() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM support_messages m
       JOIN support_tickets t ON t.id = m.ticket_id
      WHERE m.sender_type = 'student'
        AND m.read_by_admin = false
        AND t.status <> 'closed'`,
    []
  );
  return rows[0].n;
}

async function countOpenTickets() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM support_tickets
      WHERE status IN ('open', 'in_progress')`
  );
  return rows[0].n;
}

async function findMessageById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM support_messages WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function editMessage(id, newBody) {
  const { rows } = await pool.query(
    `UPDATE support_messages
        SET body = $1, edited_at = now()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *`,
    [newBody, id]
  );
  return rows[0] || null;
}

async function softDeleteMessage(id) {
  const { rows } = await pool.query(
    `UPDATE support_messages
        SET deleted_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function setTicketRead(ticketId, read) {
  const { rows } = await pool.query(
    `UPDATE support_tickets SET admin_read = $1 WHERE id = $2 RETURNING *`,
    [!!read, ticketId]
  );
  return rows[0] || null;
}

async function setTicketFolder(ticketId, folder) {
  const { rows } = await pool.query(
    `UPDATE support_tickets SET admin_folder = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [folder, ticketId]
  );
  return rows[0] || null;
}

async function listAdminFolders() {
  const { rows } = await pool.query(
    `SELECT * FROM support_admin_folders ORDER BY position ASC, name ASC`
  );
  return rows;
}

async function createAdminFolder(name, icon) {
  const { rows } = await pool.query(
    `INSERT INTO support_admin_folders (name, icon, position)
     VALUES ($1, $2, 100)
     RETURNING *`,
    [name, icon || 'fa-folder']
  );
  return rows[0];
}

async function deleteAdminFolder(name) {
  if (DEFAULT_FOLDERS.includes(name)) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE support_tickets SET admin_folder = 'inbox' WHERE admin_folder = $1`,
      [name]
    );
    const { rowCount } = await client.query(
      'DELETE FROM support_admin_folders WHERE name = $1',
      [name]
    );
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function folderCounts() {
  const { rows } = await pool.query(
    `SELECT admin_folder, COUNT(*)::int AS count
       FROM support_tickets
      WHERE status <> 'closed'
      GROUP BY admin_folder`
  );
  const map = {};
  rows.forEach(function (r) { map[r.admin_folder] = r.count; });
  return map;
}

/* ============================================================
   ADMIN FOLDERS — manage
   ============================================================ */

const DEFAULT_FOLDERS = ['inbox', 'urgent', 'later', 'archive'];

async function renameAdminFolder(oldName, newName, icon) {
  if (DEFAULT_FOLDERS.includes(oldName) && newName && newName !== oldName) {
    return null; // cannot rename a default folder
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updates = [];
    const params = [];
    if (newName && newName !== oldName) {
      params.push(newName);
      updates.push('name = $' + params.length);
    }
    if (icon) {
      params.push(icon);
      updates.push('icon = $' + params.length);
    }
    if (!updates.length) { await client.query('ROLLBACK'); return null; }
    params.push(oldName);
    const { rows } = await client.query(
      `UPDATE support_admin_folders
          SET ${updates.join(', ')}
        WHERE name = $${params.length}
        RETURNING *`,
      params
    );
    if (rows[0] && newName && newName !== oldName) {
      await client.query(
        'UPDATE support_tickets SET admin_folder = $1 WHERE admin_folder = $2',
        [newName, oldName]
      );
    }
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function reorderAdminFolders(namesInOrder) {
  if (!Array.isArray(namesInOrder) || !namesInOrder.length) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < namesInOrder.length; i++) {
      await client.query(
        'UPDATE support_admin_folders SET position = $1 WHERE name = $2',
        [i + 1, namesInOrder[i]]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ============================================================
   BULK TICKET OPERATIONS
   ============================================================ */

async function bulkSetFolder(ids, folder) {
  const { rowCount } = await pool.query(
    'UPDATE support_tickets SET admin_folder = $1, updated_at = now() WHERE id = ANY($2::uuid[])',
    [folder, ids]
  );
  return rowCount;
}

async function bulkSetRead(ids, read) {
  const { rowCount } = await pool.query(
    'UPDATE support_tickets SET admin_read = $1 WHERE id = ANY($2::uuid[])',
    [!!read, ids]
  );
  return rowCount;
}

async function bulkSetStatus(ids, status) {
  const { rowCount } = await pool.query(
    'UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = ANY($2::uuid[])',
    [status, ids]
  );
  return rowCount;
}

module.exports = {
  VALID_CATEGORIES,
  VALID_STATUSES,

  createTicket,
  findTicketById,
  listTicketsForUser,
  listAllTickets,
  updateTicketStatus,
  touchTicket,
  setTicketRead,
  setTicketFolder,

  addMessage,
  listMessagesForTicket,
  markMessagesReadByStudent,
  markMessagesReadByAdmin,
  findMessageById,
  editMessage,
  softDeleteMessage,

  countUnreadForUser,
  countUnreadForAdmin,
  countOpenTickets,

  listAdminFolders,
  createAdminFolder,
  deleteAdminFolder,
  folderCounts,
  renameAdminFolder,
  reorderAdminFolders,
  bulkSetFolder,
  bulkSetRead,
  bulkSetStatus,
};