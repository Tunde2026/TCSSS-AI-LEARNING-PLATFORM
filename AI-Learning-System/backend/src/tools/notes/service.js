const db = require('../../db');

async function list(userId, opts = {}) {
  return db.notes.listByUser(userId, opts);
}
async function get(userId, id) {
  return db.notes.findById(id, userId);
}
async function create(userId, { title, content, subject }) {
  if (title && typeof title === 'string' && title.length > 200) {
    return { ok: false, code: 'TITLE_TOO_LONG' };
  }
  const note = await db.notes.create({
    userId,
    title: (title || '').trim() || 'Untitled note',
    content: content || '',
    subject: subject || null,
  });
  return { ok: true, note };
}
async function update(userId, id, fields) {
  if (fields.title !== undefined && String(fields.title).length > 200) {
    return { ok: false, code: 'TITLE_TOO_LONG' };
  }
  const note = await db.notes.update(id, userId, fields);
  if (!note) return { ok: false, code: 'NOT_FOUND' };
  return { ok: true, note };
}
async function remove(userId, id) {
  const ok = await db.notes.remove(id, userId);
  return ok ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}

module.exports = { list, get, create, update, remove };