const { pool } = require('../pool');

async function create({ userId, title, topic, subject, durationDays, startDate, plan, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO study_plans
       (user_id, title, topic, subject, duration_days, start_date, plan, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, title, topic, subject, duration_days, start_date,
               plan, description, created_at`,
    [userId, title, topic, subject || null, durationDays, startDate, JSON.stringify(plan), description]
  );
  return rows[0];
}

async function findById(id, userId) {
  const { rows } = await pool.query(
    `SELECT id, title, topic, subject, duration_days, start_date, plan,
            description, created_at, updated_at
       FROM study_plans WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, topic, subject, duration_days, start_date, description, created_at
       FROM study_plans WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function setDescription(id, userId, description) {
  const { rows } = await pool.query(
    `UPDATE study_plans SET description = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, topic, subject, duration_days, start_date, description, created_at, updated_at`,
    [description || null, id, userId]
  );
  return rows[0] || null;
}

async function remove(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM study_plans WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { create, findById, listByUser, setDescription, remove };