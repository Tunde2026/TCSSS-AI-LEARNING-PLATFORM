const { pool } = require('../pool');

async function create({ userId, title, topic, subject, durationDays, startDate, plan }) {
  const { rows } = await pool.query(
    `INSERT INTO study_plans
       (user_id, title, topic, subject, duration_days, start_date, plan)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, title, topic, subject, duration_days, start_date,
               plan, created_at`,
    [userId, title, topic, subject || null, durationDays, startDate, JSON.stringify(plan)]
  );
  return rows[0];
}

async function findById(id, userId) {
  const { rows } = await pool.query(
    `SELECT id, title, topic, subject, duration_days, start_date, plan,
            created_at, updated_at
       FROM study_plans WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, topic, subject, duration_days, start_date, created_at
       FROM study_plans WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function remove(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM study_plans WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { create, findById, listByUser, remove };