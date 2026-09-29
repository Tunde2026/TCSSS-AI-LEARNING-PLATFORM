// ============================================================
// db/queries/announcementReplies.js
// ============================================================
const { pool } = require('../pool');

async function create({ announcementId, userId, body }) {
  const r = await pool.query(
    `INSERT INTO announcement_replies (announcement_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [announcementId, userId, body]
  );
  return r.rows[0];
}

async function listForAnnouncement(announcementId, opts) {
  opts = opts || {};
  const includeArchived = !!opts.includeArchived;
  const r = await pool.query(
    `SELECT r.id, r.body, r.admin_read, r.admin_archived,
            r.created_at, r.updated_at, r.deleted_at,
            u.id AS user_id, u.name AS user_name, u.email AS user_email,
            u.verified AS user_verified, u.is_protected AS user_protected
       FROM announcement_replies r
       JOIN users u ON u.id = r.user_id
      WHERE r.announcement_id = $1
        AND r.deleted_at IS NULL
        ${includeArchived ? '' : 'AND r.admin_archived = FALSE'}
      ORDER BY r.created_at DESC`,
    [announcementId]
  );
  return r.rows;
}

async function listAll(opts) {
  opts = opts || {};
  const limit  = Math.min(200, parseInt(opts.limit, 10) || 50);
  const offset = Math.max(0, parseInt(opts.offset, 10) || 0);
  const filter = opts.filter || 'inbox'; // inbox | unread | archived | all

  let where = 'r.deleted_at IS NULL';
  if (filter === 'inbox')    where += ' AND r.admin_archived = FALSE';
  if (filter === 'unread')   where += ' AND r.admin_read = FALSE AND r.admin_archived = FALSE';
  if (filter === 'archived') where += ' AND r.admin_archived = TRUE';

  const r = await pool.query(
    `SELECT r.id, r.body, r.admin_read, r.admin_archived,
            r.created_at, r.updated_at,
            u.id AS user_id, u.name AS user_name, u.email AS user_email,
            u.verified AS user_verified, u.is_protected AS user_protected,
            a.id AS announcement_id, a.title AS announcement_title,
            a.category AS announcement_category, a.priority AS announcement_priority
       FROM announcement_replies r
       JOIN users u ON u.id = r.user_id
       JOIN announcements a ON a.id = r.announcement_id
      WHERE ${where}
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const total = await pool.query(
    `SELECT COUNT(*)::int AS n FROM announcement_replies r WHERE ${where}`
  );

  return { replies: r.rows, total: total.rows[0].n, limit, offset };
}

async function countUnread() {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM announcement_replies
      WHERE admin_read = FALSE AND admin_archived = FALSE AND deleted_at IS NULL`
  );
  return r.rows[0].n;
}

async function findById(id) {
  const r = await pool.query(
    `SELECT * FROM announcement_replies WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return r.rows[0] || null;
}

async function setRead(id, read) {
  const r = await pool.query(
    `UPDATE announcement_replies
        SET admin_read = $1, updated_at = now()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *`,
    [!!read, id]
  );
  return r.rows[0] || null;
}

async function setArchived(id, archived) {
  const r = await pool.query(
    `UPDATE announcement_replies
        SET admin_archived = $1, updated_at = now()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *`,
    [!!archived, id]
  );
  return r.rows[0] || null;
}

async function softDelete(id) {
  const r = await pool.query(
    `UPDATE announcement_replies
        SET deleted_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
    [id]
  );
  return r.rowCount > 0;
}

async function bulkAction(ids, action) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  let sql, params;
  if (action === 'read') {
    sql = `UPDATE announcement_replies SET admin_read = TRUE, updated_at = now()
            WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`;
    params = [ids];
  } else if (action === 'unread') {
    sql = `UPDATE announcement_replies SET admin_read = FALSE, updated_at = now()
            WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`;
    params = [ids];
  } else if (action === 'archive') {
    sql = `UPDATE announcement_replies SET admin_archived = TRUE, updated_at = now()
            WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`;
    params = [ids];
  } else if (action === 'unarchive') {
    sql = `UPDATE announcement_replies SET admin_archived = FALSE, updated_at = now()
            WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`;
    params = [ids];
  } else if (action === 'delete') {
    sql = `UPDATE announcement_replies SET deleted_at = now()
            WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`;
    params = [ids];
  } else {
    return 0;
  }
  const r = await pool.query(sql, params);
  return r.rowCount;
}

async function listMineForAnnouncement(userId, announcementId) {
  const r = await pool.query(
    `SELECT id, body, created_at, admin_read
       FROM announcement_replies
      WHERE user_id = $1 AND announcement_id = $2 AND deleted_at IS NULL
      ORDER BY created_at DESC`,
    [userId, announcementId]
  );
  return r.rows;
}

module.exports = {
  create,
  listForAnnouncement,
  listAll,
  countUnread,
  findById,
  setRead,
  setArchived,
  softDelete,
  bulkAction,
  listMineForAnnouncement,
};
