// ============================================================
// admin/service.js
// ------------------------------------------------------------

const bcrypt = require('bcrypt');
const path   = require('path');
const fs     = require('fs');
const db     = require('../db');
const logger = require('../core/logger');
const storage = require('../library/storage');

const SALT_ROUNDS = 10;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['student', 'admin'];
const VALID_PROVIDERS = ['groq', 'cerebras', 'google', 'nvidia', 'openrouter', 'tavily', 'pexels', 'pollinations'];

// ---------- Users ----------

async function createUser({ name, email, password, role }) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) return { ok: false, code: 'INVALID_NAME' };
  if (!email || !EMAIL_RE.test(email)) return { ok: false, code: 'INVALID_EMAIL' };
  if (!password || typeof password !== 'string' || password.length < 8) return { ok: false, code: 'WEAK_PASSWORD' };
  if (!VALID_ROLES.includes(role)) return { ok: false, code: 'INVALID_ROLE' };

  const existing = await db.users.findByEmail(email);
  if (existing) return { ok: false, code: 'EMAIL_TAKEN' };

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await db.users.create({ name: name.trim(), email, passwordHash, role });
  logger.info(`[admin] created user ${user.email} (${user.role})`);
  return { ok: true, user };
}

async function listUsers() { return db.users.listAll(); }

async function changeRole({ targetId, newRole, currentUserId }) {
  if (!VALID_ROLES.includes(newRole)) return { ok: false, code: 'INVALID_ROLE' };
  if (targetId === currentUserId) return { ok: false, code: 'CANNOT_CHANGE_SELF' };

  const target = await db.users.findById(targetId);
  if (!target) return { ok: false, code: 'NOT_FOUND' };

  if (target.role === 'admin' && newRole !== 'admin') {
    const adminCount = await db.users.countAdmins();
    if (adminCount <= 1) return { ok: false, code: 'LAST_ADMIN' };
  }
  const updated = await db.users.updateRole(targetId, newRole);
  logger.info(`[admin] ${target.email} role: ${target.role} → ${newRole}`);
  return { ok: true, user: updated };
}

async function deleteUser({ targetId, currentUserId }) {
  if (targetId === currentUserId) return { ok: false, code: 'CANNOT_DELETE_SELF' };
  const target = await db.users.findById(targetId);
  if (!target) return { ok: false, code: 'NOT_FOUND' };
  if (target.role === 'admin') {
    const adminCount = await db.users.countAdmins();
    if (adminCount <= 1) return { ok: false, code: 'LAST_ADMIN' };
  }
  const ok = await db.users.remove(targetId);
  if (ok) logger.info(`[admin] deleted user ${target.email}`);
  return ok ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}

async function resetPassword({ targetId, newPassword }) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return { ok: false, code: 'WEAK_PASSWORD' };
  }
  const target = await db.users.findById(targetId);
  if (!target) return { ok: false, code: 'NOT_FOUND' };

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.users.updatePassword(targetId, hash);

  // Reset password invalidates all sessions
  await forceLogout(targetId);

  logger.info(`[admin] reset password for ${target.email}`);
  return { ok: true, user: { id: target.id, email: target.email } };
}

async function setSuspended({ targetId, suspended, reason, currentUserId }) {
  if (targetId === currentUserId) return { ok: false, code: 'CANNOT_SUSPEND_SELF' };

  const target = await db.users.findById(targetId);
  if (!target) return { ok: false, code: 'NOT_FOUND' };

  if (suspended && target.role === 'admin') {
    const adminCount = await db.users.countAdmins();
    if (adminCount <= 1) return { ok: false, code: 'LAST_ADMIN' };
  }

  const updated = await db.users.setSuspended(targetId, suspended, reason);
  if (suspended) await forceLogout(targetId);

  logger.info(`[admin] ${suspended ? 'suspended' : 'unsuspended'} ${target.email}`);
  return { ok: true, user: updated };
}

async function forceLogout(userId) {
  try {
    const result = await db.pool.query(
      `DELETE FROM session WHERE sess::jsonb->>'userId' = $1`,
      [userId]
    );
    logger.info(`[admin] force logout ${userId} (${result.rowCount} sessions)`);
    return { ok: true, removed: result.rowCount };
  } catch (err) {
    logger.warn('[admin] force logout failed:', err.message);
    return { ok: false };
  }
}

async function getUserActivity(userId, limit = 40) {
  const target = await db.users.findById(userId);
  if (!target) return { ok: false, code: 'NOT_FOUND' };
  const activity = await db.users.getActivity(userId, { limit });
  return { ok: true, user: target, activity };
}

async function getUserConversations(userId) {
  const target = await db.users.findById(userId);
  if (!target) return { ok: false, code: 'NOT_FOUND' };

  const rows = await db.pool.query(
    `SELECT c.id, c.title, c.pinned, c.created_at, c.updated_at,
            (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC`,
    [userId]
  );

  return {
    ok: true,
    user: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      suspended: target.suspended || false,
      created_at: target.created_at,
    },
    conversations: rows.rows,
  };
}

async function getConversationForAdmin(conversationId) {
  const conv = await db.pool.query(
    `SELECT c.id, c.title, c.pinned, c.created_at, c.updated_at,
            u.id   AS user_id,
            u.name AS user_name,
            u.email AS user_email
       FROM conversations c
       JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
      LIMIT 1`,
    [conversationId]
  );

  if (!conv.rowCount) return { ok: false, code: 'NOT_FOUND' };

  const msgs = await db.pool.query(
    `SELECT id, role, content, provider, media, created_at
       FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC`,
    [conversationId]
  );

  return {
    ok: true,
    conversation: conv.rows[0],
    messages: msgs.rows,
  };
}

async function getStats() {
  const [total, admins, students, newThisWeek] = await Promise.all([
    db.users.countAll(), db.users.countAdmins(),
    db.users.countStudents(), db.users.countNewSince(7),
  ]);
  let resources = 0, conversations = 0;
  try { resources = (await db.pool.query('SELECT COUNT(*)::int AS n FROM library_documents')).rows[0].n; } catch (_) {}
  try { conversations = (await db.pool.query('SELECT COUNT(*)::int AS n FROM conversations')).rows[0].n; } catch (_) {}
  return { total, admins, students, newThisWeek, resources, conversations };
}

// ---------- Settings ----------

async function getSettings() {
  const rows = await db.settings.listAll();
  return rows.map(r => ({
    key: r.key, value: r.value, type: r.type,
    description: r.description, category: r.category, updated_at: r.updated_at,
  }));
}

async function updateSettings({ updates, adminId }) {
  if (!Array.isArray(updates) || updates.length === 0) return { ok: false, code: 'NO_UPDATES' };
  const validated = [];
  for (const u of updates) {
    if (!u || typeof u.key !== 'string' || !u.key) return { ok: false, code: 'INVALID_ENTRY' };
    if (!['string','number','boolean','json'].includes(u.type)) return { ok: false, code: 'INVALID_TYPE' };
    if (u.type === 'number'  && typeof u.value !== 'number')  return { ok: false, code: 'INVALID_VALUE', detail: `${u.key} must be a number` };
    if (u.type === 'boolean' && typeof u.value !== 'boolean') return { ok: false, code: 'INVALID_VALUE', detail: `${u.key} must be true or false` };
    if (u.type === 'string'  && typeof u.value !== 'string')  return { ok: false, code: 'INVALID_VALUE', detail: `${u.key} must be a string` };
    validated.push({ key: u.key, value: u.value, type: u.type });
  }
  await db.settings.setMany(validated, adminId);
  const core = require('../core');
  await core.settings.setMany(validated);
  logger.info(`[admin] updated ${validated.length} settings`);
  return { ok: true, count: validated.length };
}

// ---------- Ollama ----------

async function listOllamaModels() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (!res.ok) return { ok: false, code: 'OLLAMA_ERROR' };
    const data = await res.json();
    const models = (data.models || []).map(m => ({
      name: m.name, size: m.size,
      family: m.details && m.details.family,
      params: m.details && m.details.parameter_size,
      quant:  m.details && m.details.quantization_level,
      modified: m.modified_at,
    }));
    return { ok: true, models };
  } catch (err) {
    logger.warn('[admin] ollama list failed:', err.message);
    return { ok: false, code: 'OLLAMA_UNREACHABLE' };
  }
}

// ---------- Provider Keys ----------

function maskKey(k) {
  if (!k || k.length < 8) return '••••';
  return k.slice(0, 4) + '••••••••' + k.slice(-4);
}

async function listProviderKeys() {
  const rows = await db.providerKeys.listAll();
  return rows.map(r => ({
    id: r.id, provider: r.provider, label: r.label,
    maskedKey: maskKey(r.key_value), keyLength: r.key_value.length,
    enabled: r.enabled, lastUsedAt: r.last_used_at, lastError: r.last_error,
    createdAt: r.created_at,
  }));
}

async function createProviderKey({ provider, label, keyValue }) {
  if (!VALID_PROVIDERS.includes(provider)) return { ok: false, code: 'INVALID_PROVIDER' };
  if (!keyValue || typeof keyValue !== 'string' || keyValue.trim().length < 6) return { ok: false, code: 'INVALID_KEY' };
  const row = await db.providerKeys.create({ provider, label: label || null, keyValue: keyValue.trim() });
  await refreshKeys();
  return { ok: true, key: {
    id: row.id, provider: row.provider, label: row.label,
    maskedKey: maskKey(row.key_value), enabled: row.enabled, createdAt: row.created_at,
  }};
}

async function updateProviderKey({ id, label, keyValue, enabled }) {
  const fields = {};
  if (label !== undefined)    fields.label = label;
  if (keyValue !== undefined) fields.keyValue = keyValue.trim();
  if (enabled !== undefined)  fields.enabled = Boolean(enabled);
  const updated = await db.providerKeys.update(id, fields);
  if (!updated) return { ok: false, code: 'NOT_FOUND' };
  await refreshKeys();
  return { ok: true };
}

async function deleteProviderKey(id) {
  const ok = await db.providerKeys.remove(id);
  if (!ok) return { ok: false, code: 'NOT_FOUND' };
  await refreshKeys();
  return { ok: true };
}

async function refreshKeys() {
  try {
    const ai = require('../ai');
    if (ai.keyStore && ai.keyStore.loadAndApply) await ai.keyStore.loadAndApply();
  } catch (err) { logger.warn('[admin] refreshKeys failed:', err.message); }
}

// ---------- Branding ----------

async function uploadLogo({ file, adminId }) {
  const check = storage.validateLogo(file);
  if (!check.ok) return { ok: false, code: 'INVALID_LOGO', detail: check.reason };
  const saved = storage.saveLogo({ file });
  const core = require('../core');
  await db.settings.setMany([{ key: 'platform.logo_url', value: saved.url, type: 'string' }], adminId);
  await core.settings.setMany([{ key: 'platform.logo_url', value: saved.url, type: 'string' }]);
  return { ok: true, url: saved.url };
}

async function removeLogo({ adminId }) {
  const core = require('../core');
  const current = await core.settings.getSetting('platform.logo_url', '');
  if (current) {
    try {
      const fullPath = path.join(storage.BRANDING_DIR, path.basename(current));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (_) {}
  }
  await db.settings.setMany([{ key: 'platform.logo_url', value: '', type: 'string' }], adminId);
  await core.settings.setMany([{ key: 'platform.logo_url', value: '', type: 'string' }]);
  return { ok: true };
}

// ---------- Manual knowledge ----------

async function addManualKnowledge({ adminId, title, subject, level, text }) {
  if (!title || typeof title !== 'string' || title.trim().length < 2) return { ok: false, code: 'INVALID_TITLE' };
  if (!text || typeof text !== 'string' || text.trim().length < 100) return { ok: false, code: 'TOO_SHORT' };

  const cleanTitle = title.trim();
  const cleanText = text.trim();
  const saved = storage.saveManualEntry({ title: cleanTitle, text: cleanText });

  const doc = await db.library.create({
    uploadedBy: adminId,
    title: cleanTitle,
    subject: subject || null,
    level: level || null,
    author: 'Manual entry',
    filename: saved.filename,
    originalName: cleanTitle + '.txt',
    mimeType: 'text/plain',
    sizeBytes: saved.sizeBytes,
    storagePath: saved.fullPath,
  });

  try {
    await db.pool.query(
      `UPDATE library_documents
          SET source_type = 'manual', approved = TRUE, status = 'approved',
              approved_at = now(), approved_by = $2
        WHERE id = $1`,
      [doc.id, adminId]
    );
    doc.approved = true;
  } catch (err) { logger.warn('[admin] manual mark failed:', err.message); }

  const processor = require('../library/processor');
  processor.processInBackground(doc.id);
  return { ok: true, document: doc };
}

module.exports = {
  createUser, listUsers, changeRole, deleteUser,
  resetPassword, setSuspended, forceLogout, getUserActivity,
  getUserConversations, getConversationForAdmin,   // ← new
  getStats,
  getSettings, updateSettings,
  listOllamaModels,
  listProviderKeys, createProviderKey, updateProviderKey, deleteProviderKey,
  uploadLogo, removeLogo,
  addManualKnowledge,
};