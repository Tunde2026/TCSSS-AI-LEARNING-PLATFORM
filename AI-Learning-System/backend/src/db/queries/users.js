// All user-related database queries live here.
// Nothing outside this file should write raw SQL for the users table.

const { pool } = require('../pool');

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, created_at
       FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, password_hash, created_at
       FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

async function create({ name, email, passwordHash, role = 'student' }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email.toLowerCase(), passwordHash, role]
  );
  return rows[0];
}

module.exports = { findById, findByEmail, create };