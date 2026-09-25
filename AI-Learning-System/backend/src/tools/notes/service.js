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

/* ------------------------------------------------------------
   AI transformation of a note.
   Actions: summarize | rephrase | fix_typos | simplify | expand |
            key_points | outline
   ------------------------------------------------------------ */
async function aiTransform({ userId, noteId, action, useEditedContent, editedContent }) {
  const { buildPrompt, ALL_ACTIONS } = require('./prompt');

  if (!ALL_ACTIONS.includes(action)) {
    return { ok: false, code: 'INVALID_ACTION' };
  }

  const note = await get(userId, noteId);
  if (!note) return { ok: false, code: 'NOT_FOUND' };

  // Source content: either the saved note or a draft the student has edited
  const source = (useEditedContent && typeof editedContent === 'string' && editedContent.trim())
    ? editedContent
    : (note.content || '');

  if (!source.trim()) return { ok: false, code: 'EMPTY_NOTE' };
  if (source.length > 12000) return { ok: false, code: 'TOO_LONG' };

  const prompt = buildPrompt(action);
  if (!prompt) return { ok: false, code: 'INVALID_ACTION' };

  const { chat } = require('../../ai/gateway');
  const logger = require('../../core/logger');

  let result;
  try {
    result = await chat({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user',   content: source },
      ],
      temperature: 0.4,
      maxTokens: 1500,
    });
  } catch (err) {
    logger.warn('[notes/ai] ' + err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  const output = String(result.text || '').trim();
  if (!output) return { ok: false, code: 'EMPTY_AI_OUTPUT' };

  return {
    ok: true,
    action: action,
    label: prompt.label,
    original: source,
    result: output,
    provider: result.provider || null,
  };
}

module.exports = { list, get, create, update, remove,  aiTransform,  };