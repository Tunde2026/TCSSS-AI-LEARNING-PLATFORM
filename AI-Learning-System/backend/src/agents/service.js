// Custom @AI agent business logic.

const db     = require('../db');
const logger = require('../core/logger');

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,29}$/;   // letters, digits, underscore, 1-30 chars
const MAX_PROMPT = 4000;
const VALID_TOOLS = ['explain', 'simplify', 'analogy', 'summary', 'quiz', 'flashcards',
                     'visualize', 'practice', 'web_search'];
const VALID_LEVELS = ['jss', 'sss', 'waec', 'jamb', 'beginner', 'intermediate', 'advanced'];

function validate(payload, { forCreate }) {
  const { name, systemPrompt } = payload || {};

  if (forCreate || name !== undefined) {
    if (!name || !NAME_RE.test(name)) {
      return 'Name must start with a letter, use only letters, numbers, and underscores, and be 1–30 characters.';
    }
  }
  if (forCreate || systemPrompt !== undefined) {
    if (!systemPrompt || typeof systemPrompt !== 'string'
        || systemPrompt.trim().length < 10) {
      return 'Instructions must be at least 10 characters.';
    }
    if (systemPrompt.length > MAX_PROMPT) {
      return 'Instructions are too long.';
    }
  }
  return null;
}

async function list(userId) {
  return db.agents.listByUser(userId);
}

async function get(userId, id) {
  return db.agents.findById(id, userId);
}

async function create(userId, payload) {
  const err = validate(payload, { forCreate: true });
  if (err) return { ok: false, code: 'INVALID', detail: err };

  const existing = await db.agents.findByName(userId, payload.name);
  if (existing) return { ok: false, code: 'NAME_TAKEN' };

  const allowedTools = Array.isArray(payload.allowedTools)
    ? payload.allowedTools.filter(t => VALID_TOOLS.includes(t))
    : [];

  const agent = await db.agents.create({
    userId,
    name: payload.name,
    description: payload.description || null,
    systemPrompt: payload.systemPrompt.trim(),
    subject: payload.subject || null,
    level: VALID_LEVELS.includes(payload.level) ? payload.level : null,
    learningStyle: payload.learningStyle || null,
    allowedTools,
  });

  logger.info(`[agents] user ${userId} created @${agent.name}`);
  return { ok: true, agent };
}

async function update(userId, id, payload) {
  const err = validate(payload, { forCreate: false });
  if (err) return { ok: false, code: 'INVALID', detail: err };

  const existing = await db.agents.findById(id, userId);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };

  // Check name collision if renaming
  if (payload.name && payload.name !== existing.name) {
    const collision = await db.agents.findByName(userId, payload.name);
    if (collision) return { ok: false, code: 'NAME_TAKEN' };
  }

  const updates = {};
  if (payload.name !== undefined)          updates.name = payload.name;
  if (payload.description !== undefined)   updates.description = payload.description;
  if (payload.systemPrompt !== undefined)  updates.system_prompt = payload.systemPrompt.trim();
  if (payload.subject !== undefined)       updates.subject = payload.subject;
  if (payload.level !== undefined)         updates.level = payload.level;
  if (payload.learningStyle !== undefined) updates.learning_style = payload.learningStyle;
  if (payload.allowedTools !== undefined) {
    updates.allowed_tools = Array.isArray(payload.allowedTools)
      ? payload.allowedTools.filter(t => VALID_TOOLS.includes(t))
      : [];
  }

  const agent = await db.agents.update(id, userId, updates);
  if (!agent) return { ok: false, code: 'NOT_FOUND' };
  return { ok: true, agent };
}

async function remove(userId, id) {
  const ok = await db.agents.remove(id, userId);
  return ok ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}

// Resolve a @Name mention in a message into an agent (or null).
async function resolveMention(userId, text) {
  const match = text.match(/@([A-Za-z][A-Za-z0-9_]{0,29})/);
  if (!match) return null;
  const name = match[1];
  const agent = await db.agents.findByName(userId, name);
  return agent || null;
}

module.exports = {
  list, get, create, update, remove,
  resolveMention,
  VALID_TOOLS, VALID_LEVELS,
};