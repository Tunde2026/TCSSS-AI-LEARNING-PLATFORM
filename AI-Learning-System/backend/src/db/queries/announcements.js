// ============================================================
// db/queries/announcements.js
// ============================================================
const { pool } = require('../pool');

async function listAll() {
  const r = await pool.query(
    `SELECT a.*, u.name AS author_name,
            (SELECT COUNT(*)::int FROM announcement_views v
              WHERE v.announcement_id = a.id) AS view_count,
            (SELECT COUNT(*)::int FROM announcement_dismissals d
              WHERE d.announcement_id = a.id) AS dismissed_count,
            (SELECT COUNT(*)::int FROM announcement_replies rp
              WHERE rp.announcement_id = a.id) AS reply_count
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
      WHERE a.deleted_at IS NULL
      ORDER BY a.created_at DESC`
  );
  return r.rows;
}

async function findById(id) {
  const r = await pool.query(
    `SELECT * FROM announcements WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return r.rows[0] || null;
}

async function create(data) {
  const r = await pool.query(
    `INSERT INTO announcements (
       title, body, category, priority, display_mode,
       modal_delay_seconds, inline_delay_seconds, cooldown_hours,
       action_label, action_url, action_style, action_new_tab,
       starts_at, expires_at, is_active, target_role, sticky, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
               COALESCE($13, now()), $14, $15, $16, $17, $18)
     RETURNING *`,
    [
      data.title, data.body, data.category, data.priority, data.display_mode,
      data.modal_delay_seconds, data.inline_delay_seconds, data.cooldown_hours,
      data.action_label, data.action_url, data.action_style, data.action_new_tab,
      data.starts_at || null, data.expires_at || null,
      data.is_active, data.target_role, !!data.sticky, data.created_by,
    ]
  );
  return r.rows[0];
}

async function update(id, fields) {
  const allowed = ['title','body','category','priority','display_mode',
    'modal_delay_seconds','inline_delay_seconds','cooldown_hours',
    'action_label','action_url','action_style','action_new_tab',
    'starts_at','expires_at','is_active','target_role','sticky'];
  const sets = [], values = [];
  let i = 1;
  for (const k of allowed) {
    if (fields[k] !== undefined) { sets.push(k + ' = $' + i); values.push(fields[k]); i++; }
  }
  if (!sets.length) return null;
  sets.push('updated_at = now()');
  values.push(id);
  const r = await pool.query(
    `UPDATE announcements SET ${sets.join(', ')}
      WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
    values
  );
  return r.rows[0] || null;
}

async function softDelete(id) {
  const r = await pool.query(
    `UPDATE announcements SET deleted_at = now(), is_active = FALSE
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id]
  );
  return r.rowCount > 0;
}

async function listActiveForUser(userId, role) {
  const r = await pool.query(
    `SELECT a.*, d.dismissed_at
       FROM announcements a
       LEFT JOIN announcement_dismissals d
              ON d.announcement_id = a.id AND d.user_id = $1
      WHERE a.deleted_at IS NULL
        AND a.is_active = TRUE
        AND (a.starts_at IS NULL OR a.starts_at <= now())
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND (a.target_role = 'all' OR a.target_role = $2)
        AND (
          a.sticky = TRUE
          OR d.dismissed_at IS NULL
          OR (a.cooldown_hours > 0
              AND d.dismissed_at + (a.cooldown_hours * interval '1 hour') < now())
        )
      ORDER BY
        a.sticky DESC,
        CASE a.priority WHEN 'urgent' THEN 1 WHEN 'important' THEN 2 ELSE 3 END,
        a.created_at DESC`,
    [userId, role]
  );
  return r.rows;
}

async function recordDismissal(announcementId, userId) {
  await pool.query(
    `INSERT INTO announcement_dismissals (announcement_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (announcement_id, user_id)
     DO UPDATE SET dismissed_at = now()`,
    [announcementId, userId]
  );
}

/* ---------- View tracking ---------- */
async function recordView(announcementId, userId, displayMode) {
  await pool.query(
    `INSERT INTO announcement_views
       (announcement_id, user_id, first_viewed_at, last_viewed_at, view_count, display_mode)
     VALUES ($1, $2, now(), now(), 1, $3)
     ON CONFLICT (announcement_id, user_id)
     DO UPDATE SET last_viewed_at = now(),
                   view_count     = announcement_views.view_count + 1,
                   display_mode   = COALESCE(EXCLUDED.display_mode, announcement_views.display_mode)`,
    [announcementId, userId, displayMode || null]
  );
}

async function listViewers(announcementId) {
  const r = await pool.query(
    `SELECT v.id,
            v.first_viewed_at,
            v.last_viewed_at,
            v.view_count,
            v.display_mode,
            d.dismissed_at,
            u.id    AS user_id,
            u.name  AS user_name,
            u.email AS user_email,
            u.role  AS user_role
       FROM announcement_views v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN announcement_dismissals d
              ON d.announcement_id = v.announcement_id
             AND d.user_id = v.user_id
      WHERE v.announcement_id = $1
      ORDER BY v.last_viewed_at DESC`,
    [announcementId]
  );
  return r.rows;
}

async function clearViews(announcementId) {
  const r = await pool.query(
    `DELETE FROM announcement_views WHERE announcement_id = $1`,
    [announcementId]
  );
  return r.rowCount;
}

module.exports = {
  listAll, findById, create, update, softDelete,
  listActiveForUser, recordDismissal,
  recordView, listViewers, clearViews,
};

/* ---------- Announcement replies ---------- */
async function createReply(announcementId, userId, body) {
  const r = await pool.query(
    `INSERT INTO announcement_replies (announcement_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [announcementId, userId, body]
  );
  return r.rows[0];
}

async function listRepliesForAnnouncement(announcementId, { limit = 200 } = {}) {
  const r = await pool.query(
    `SELECT r.id, r.announcement_id, r.user_id, r.body, r.created_at, r.updated_at,
            u.name AS user_name, u.email AS user_email, u.role AS user_role
       FROM announcement_replies r
       JOIN users u ON u.id = r.user_id
      WHERE r.announcement_id = $1
      ORDER BY r.created_at ASC
      LIMIT $2`,
    [announcementId, limit]
  );
  return r.rows;
}

async function countRepliesByAnnouncement() {
  const r = await pool.query(
    `SELECT announcement_id, COUNT(*)::int AS count
       FROM announcement_replies
      GROUP BY announcement_id`
  );
  const out = {};
  r.rows.forEach(function (row) { out[row.announcement_id] = row.count; });
  return out;
}

async function deleteReply(replyId, userId) {
  const r = await pool.query(
    `DELETE FROM announcement_replies
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [replyId, userId]
  );
  return r.rowCount > 0;
}

module.exports.createReply = createReply;
module.exports.listRepliesForAnnouncement = listRepliesForAnnouncement;
module.exports.countRepliesByAnnouncement = countRepliesByAnnouncement;
module.exports.deleteReply = deleteReply;
