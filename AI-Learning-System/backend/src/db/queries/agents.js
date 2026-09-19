const { pool } = require('../pool');

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, description, system_prompt, subject, level,
            learning_style, allowed_tools, created_at, updated_at
       FROM custom_agents
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function findById(id, userId) {
  const { rows } = await pool.query(
    `SELECT id, name, description, system_prompt, subject, level,
            learning_style, allowed_tools, created_at, updated_at
       FROM custom_agents
      WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function findByName(userId, name) {
  const { rows } = await pool.query(
    `SELECT id, name, description, system_prompt, subject, level,
            learning_style, allowed_tools, created_at, updated_at
       FROM custom_agents
      WHERE user_id = $1 AND lower(name) = lower($2)`,
    [userId, name]
  );
  return rows[0] || null;
}

async function create({ userId, name, description, systemPrompt, subject,
                        level, learningStyle, allowedTools }) {
  const { rows } = await pool.query(
    `INSERT INTO custom_agents
       (user_id, name, description, system_prompt, subject, level,
        learning_style, allowed_tools)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, description, system_prompt, subject, level,
               learning_style, allowed_tools, created_at, updated_at`,
    [
      userId, name, description || null, systemPrompt,
      subject || null, level || null, learningStyle || null,
      JSON.stringify(allowedTools || []),
    ]
  );
  return rows[0];
}

async function update(id, userId, fields) {
  const allowed = ['name', 'description', 'system_prompt', 'subject',
                   'level', 'learning_style', 'allowed_tools'];
  const sets = [];
  const params = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    sets.push(`${key} = $${idx++}`);
    params.push(key === 'allowed_tools' ? JSON.stringify(value) : value);
  }
  if (sets.length === 0) return null;

  sets.push('updated_at = now()');
  params.push(id, userId);

  const { rows } = await pool.query(
    `UPDATE custom_agents
        SET ${sets.join(', ')}
      WHERE id = $${idx++} AND user_id = $${idx}
      RETURNING id, name, description, system_prompt, subject, level,
                learning_style, allowed_tools, created_at, updated_at`,
    params
  );
  return rows[0] || null;
}

async function remove(id, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM custom_agents WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { listByUser, findById, findByName, create, update, remove };