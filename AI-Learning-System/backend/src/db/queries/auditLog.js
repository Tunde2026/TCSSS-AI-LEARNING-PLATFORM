const { pool } = require('../pool');

async function insert({ adminId, adminEmail, action, targetType, targetId, targetLabel, details, ip }) {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (admin_id, admin_email, action, target_type, target_id, target_label, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        adminId || null,
        adminEmail || null,
        action,
        targetType || null,
        targetId || null,
        targetLabel || null,
        details ? JSON.stringify(details) : null,
        ip || null,
      ]
    );
  } catch (_) { /* never fail the caller */ }
}

async function list({ limit = 100, offset = 0, action, adminId } = {}) {
  const params = [];
  const where = [];

  if (action)  { params.push(action); where.push(`action = $${params.length}`); }
  if (adminId) { params.push(adminId); where.push(`admin_id = $${params.length}`); }

  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT id, admin_id, admin_email, action, target_type, target_id,
            target_label, details, ip, created_at
       FROM audit_log${whereSql}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function count({ action, adminId } = {}) {
  const params = [];
  const where = [];
  if (action)  { params.push(action); where.push(`action = $${params.length}`); }
  if (adminId) { params.push(adminId); where.push(`admin_id = $${params.length}`); }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM audit_log${whereSql}`, params);
  return rows[0].n;
}

async function distinctActions() {
  const { rows } = await pool.query(
    `SELECT DISTINCT action FROM audit_log ORDER BY action ASC`
  );
  return rows.map(r => r.action);
}

async function distinctAdmins() {
  const { rows } = await pool.query(
    `SELECT DISTINCT admin_id, admin_email
       FROM audit_log
      WHERE admin_id IS NOT NULL
      ORDER BY admin_email ASC`
  );
  return rows;
}

async function removeOlderThan(days) {
  const { rowCount } = await pool.query(
    `DELETE FROM audit_log
      WHERE created_at < now() - ($1 || ' days')::interval`,
    [String(days)]
  );
  return rowCount;
}

module.exports = { insert, list, count, distinctActions, distinctAdmins, removeOlderThan };