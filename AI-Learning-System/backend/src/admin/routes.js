// ============================================================
// admin/routes.js
// ------------------------------------------------------------

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const service = require('./service');
const backup  = require('./backup');
const { requireAdmin } = require('../auth');
const core = require('../core');
const db   = require('../db');

const { audit } = core;

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ---------- Users ----------

router.get('/users', requireAdmin, async (req, res, next) => {
  try { res.json({ users: await service.listUsers() }); }
  catch (err) { next(err); }
});

router.post('/users', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    const result = await service.createUser({ name, email, password, role });
    if (!result.ok) {
      const map = {
        INVALID_NAME:  [400, 'Please enter a valid name.'],
        INVALID_EMAIL: [400, 'Please enter a valid email address.'],
        WEAK_PASSWORD: [400, 'Password must be at least 8 characters.'],
        INVALID_ROLE:  [400, 'Role must be either "student" or "admin".'],
        EMAIL_TAKEN:   [409, 'An account with that email already exists.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not create user.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    await audit.log({
      req, action: 'user.create', targetType: 'user',
      targetId: result.user.id, targetLabel: result.user.email,
      details: { role: result.user.role, name: result.user.name },
    });
    res.status(201).json({ user: result.user });
  } catch (err) { next(err); }
});

router.patch('/users/:id/role', requireAdmin, async (req, res, next) => {
  try {
    const newRole = (req.body && req.body.role) || '';
    const result = await service.changeRole({ targetId: req.params.id, newRole, currentUserId: req.user.id });
    if (!result.ok) {
      const map = {
        INVALID_ROLE:       [400, 'Invalid role.'],
        CANNOT_CHANGE_SELF: [400, 'You cannot change your own role.'],
        NOT_FOUND:          [404, 'User not found.'],
        LAST_ADMIN:         [400, 'Cannot demote the last admin.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not update role.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    await audit.log({
      req, action: 'user.role_change', targetType: 'user',
      targetId: result.user.id, targetLabel: result.user.email,
      details: { newRole: result.user.role },
    });
    res.json({ user: result.user });
  } catch (err) { next(err); }
});

router.post('/users/:id/reset-password', requireAdmin, async (req, res, next) => {
  try {
    const newPassword = (req.body && req.body.newPassword) || '';
    const result = await service.resetPassword({ targetId: req.params.id, newPassword });
    if (!result.ok) {
      const map = {
        WEAK_PASSWORD: [400, 'Password must be at least 8 characters.'],
        NOT_FOUND:     [404, 'User not found.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not reset password.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    await audit.log({
      req, action: 'user.reset_password', targetType: 'user',
      targetId: result.user.id, targetLabel: result.user.email,
    });
    res.json({ ok: true, user: result.user });
  } catch (err) { next(err); }
});

router.patch('/users/:id/suspend', requireAdmin, async (req, res, next) => {
  try {
    const suspended = Boolean(req.body && req.body.suspended);
    const reason = (req.body && req.body.reason) || null;
    const result = await service.setSuspended({
      targetId: req.params.id, suspended, reason, currentUserId: req.user.id,
    });
    if (!result.ok) {
      const map = {
        CANNOT_SUSPEND_SELF: [400, 'You cannot suspend your own account.'],
        NOT_FOUND:           [404, 'User not found.'],
        LAST_ADMIN:          [400, 'Cannot suspend the last admin.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not update suspension.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    await audit.log({
      req,
      action: suspended ? 'user.suspend' : 'user.unsuspend',
      targetType: 'user',
      targetId: result.user.id,
      targetLabel: result.user.email,
      details: suspended ? { reason } : null,
    });
    res.json({ user: result.user });
  } catch (err) { next(err); }
});

router.post('/users/:id/force-logout', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.forceLogout(req.params.id);
    await audit.log({
      req, action: 'user.force_logout', targetType: 'user',
      targetId: req.params.id, details: { removed: result.removed || 0 },
    });
    res.json({ ok: true, removed: result.removed || 0 });
  } catch (err) { next(err); }
});

router.get('/users/:id/activity', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 40);
    const result = await service.getUserActivity(req.params.id, limit);
    if (!result.ok) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.user, activity: result.activity });
  } catch (err) { next(err); }
});

router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const target = await service.listUsers().then(list => list.find(u => u.id === req.params.id));
    const result = await service.deleteUser({ targetId: req.params.id, currentUserId: req.user.id });
    if (!result.ok) {
      const map = {
        CANNOT_DELETE_SELF: [400, 'You cannot delete your own account.'],
        NOT_FOUND:          [404, 'User not found.'],
        LAST_ADMIN:         [400, 'Cannot delete the last admin.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not delete user.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    await audit.log({
      req, action: 'user.delete', targetType: 'user',
      targetId: req.params.id, targetLabel: target ? target.email : null,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- Stats ----------

router.get('/stats', requireAdmin, async (req, res, next) => {
  try { res.json(await service.getStats()); }
  catch (err) { next(err); }
});

// ---------- Settings ----------

router.get('/settings', requireAdmin, async (req, res, next) => {
  try { res.json({ settings: await service.getSettings() }); }
  catch (err) { next(err); }
});

router.patch('/settings', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.updateSettings({
      updates: req.body && req.body.updates, adminId: req.user.id,
    });
    if (!result.ok) {
      const map = {
        NO_UPDATES:    [400, 'No updates provided.'],
        INVALID_ENTRY: [400, 'Each update needs a key and value.'],
        INVALID_TYPE:  [400, 'Invalid type.'],
        INVALID_VALUE: [400, result.detail || 'Invalid value.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not update settings.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    const updates = req.body.updates || [];
    await audit.log({
      req, action: 'settings.update', targetType: 'settings',
      details: { count: result.count, keys: updates.map(u => u.key) },
    });
    const settings = await service.getSettings();
    res.json({ ok: true, count: result.count, settings });
  } catch (err) { next(err); }
});

// ---------- Ollama ----------

router.get('/models', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.listOllamaModels();
    if (!result.ok) return res.status(503).json({ error: 'Could not reach Ollama.', code: result.code });
    res.json({ models: result.models });
  } catch (err) { next(err); }
});

// ---------- Provider keys ----------

router.get('/keys', requireAdmin, async (req, res, next) => {
  try { res.json({ keys: await service.listProviderKeys() }); }
  catch (err) { next(err); }
});

router.post('/keys', requireAdmin, async (req, res, next) => {
  try {
    const { provider, label, keyValue } = req.body || {};
    const result = await service.createProviderKey({ provider, label, keyValue });
    if (!result.ok) {
      const map = { INVALID_PROVIDER: [400, 'Unknown provider.'], INVALID_KEY: [400, 'Key looks too short.'] };
      const [s, m] = map[result.code] || [400, 'Could not add key.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    await audit.log({
      req, action: 'key.add', targetType: 'key',
      targetId: result.key.id, targetLabel: result.key.provider,
      details: { label: result.key.label },
    });
    res.status(201).json({ key: result.key });
  } catch (err) { next(err); }
});

router.patch('/keys/:id', requireAdmin, async (req, res, next) => {
  try {
    const { label, keyValue, enabled } = req.body || {};
    const result = await service.updateProviderKey({ id: req.params.id, label, keyValue, enabled });
    if (!result.ok) return res.status(404).json({ error: 'Key not found.' });
    await audit.log({
      req, action: 'key.update', targetType: 'key',
      targetId: req.params.id,
      details: { enabled: enabled !== undefined ? Boolean(enabled) : undefined,
                 changedValue: !!keyValue },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/keys/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.deleteProviderKey(req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Key not found.' });
    await audit.log({
      req, action: 'key.delete', targetType: 'key', targetId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- Branding ----------

router.post('/branding/logo', requireAdmin, logoUpload.single('logo'), async (req, res, next) => {
  try {
    const result = await service.uploadLogo({ file: req.file, adminId: req.user.id });
    if (!result.ok) return res.status(400).json({ error: result.detail || 'Could not save logo.', code: result.code });
    await audit.log({
      req, action: 'logo.upload', targetType: 'branding', targetLabel: 'logo',
    });
    res.status(201).json({ url: result.url });
  } catch (err) { next(err); }
});

router.delete('/branding/logo', requireAdmin, async (req, res, next) => {
  try {
    await service.removeLogo({ adminId: req.user.id });
    await audit.log({ req, action: 'logo.remove', targetType: 'branding', targetLabel: 'logo' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- Knowledge ----------

router.get('/knowledge/stats', requireAdmin, async (req, res, next) => {
  try { res.json({ stats: await db.knowledge.getStats() }); }
  catch (err) { next(err); }
});

router.get('/knowledge/documents', requireAdmin, async (req, res, next) => {
  try { res.json({ documents: await db.knowledge.listDocuments({ status: req.query.status }) }); }
  catch (err) { next(err); }
});

router.post('/knowledge/manual', requireAdmin, async (req, res, next) => {
  try {
    const { title, subject, level, text } = req.body || {};
    const result = await service.addManualKnowledge({ adminId: req.user.id, title, subject, level, text });
    if (!result.ok) {
      const map = { INVALID_TITLE: [400, 'Title is required.'], TOO_SHORT: [400, 'Text must be at least 100 characters.'] };
      const [s, m] = map[result.code] || [400, 'Could not add knowledge.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    await audit.log({
      req, action: 'knowledge.add_manual', targetType: 'document',
      targetId: result.document.id, targetLabel: result.document.title,
    });
    res.status(201).json({ document: result.document });
  } catch (err) { next(err); }
});

router.get('/knowledge/documents/:id/chunks', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const chunks = await db.knowledge.listChunks(req.params.id, { limit, offset });
    res.json({ chunks, limit, offset });
  } catch (err) { next(err); }
});

router.patch('/knowledge/chunks/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const approved = Boolean(req.body && req.body.approved);
    const chunk = await db.knowledge.setChunkApproved(req.params.id, approved);
    if (!chunk) return res.status(404).json({ error: 'Chunk not found' });
    res.json({ chunk });
  } catch (err) { next(err); }
});

router.delete('/knowledge/chunks/:id', requireAdmin, async (req, res, next) => {
  try {
    const ok = await db.knowledge.removeChunk(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Chunk not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/knowledge/chunks/bulk', requireAdmin, async (req, res, next) => {
  try {
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    if (!['approve', 'unapprove', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve, unapprove, or delete' });
    }
    let affected = 0;
    if (action === 'delete') {
      const r = await db.pool.query('DELETE FROM document_chunks WHERE id = ANY($1::uuid[])', [ids]);
      affected = r.rowCount;
    } else {
      const approved = action === 'approve';
      const r = await db.pool.query(
        'UPDATE document_chunks SET approved = $1 WHERE id = ANY($2::uuid[])',
        [approved, ids]
      );
      affected = r.rowCount;
    }
    await audit.log({
      req, action: 'knowledge.bulk_chunks', targetType: 'chunk',
      details: { action, count: affected, ids: ids.slice(0, 20) },
    });
    res.json({ ok: true, affected });
  } catch (err) { next(err); }
});

router.post('/knowledge/documents/bulk', requireAdmin, async (req, res, next) => {
  try {
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    if (!['approve', 'unapprove', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve, unapprove, or delete' });
    }
    let affected = 0;
    if (action === 'delete') {
      const docs = await db.pool.query('SELECT storage_path FROM library_documents WHERE id = ANY($1::uuid[])', [ids]);
      for (const d of docs.rows) {
        try { require('../library/storage').removeFile(d.storage_path); } catch (_) {}
      }
      const r = await db.pool.query('DELETE FROM library_documents WHERE id = ANY($1::uuid[])', [ids]);
      affected = r.rowCount;
    } else {
      const approved = action === 'approve';
      const r = await db.pool.query(
        `UPDATE library_documents
            SET approved = $1, status = $2,
                approved_at = CASE WHEN $1 THEN now() ELSE NULL END
          WHERE id = ANY($3::uuid[])`,
        [approved, approved ? 'approved' : 'rejected', ids]
      );
      affected = r.rowCount;
      await db.pool.query(
        'UPDATE document_chunks SET approved = $1 WHERE document_id = ANY($2::uuid[])',
        [approved, ids]
      );
    }
    await audit.log({
      req, action: 'knowledge.bulk_documents', targetType: 'document',
      details: { action, count: affected, ids: ids.slice(0, 20) },
    });
    res.json({ ok: true, affected });
  } catch (err) { next(err); }
});

router.post('/knowledge/documents/:id/reprocess', requireAdmin, async (req, res, next) => {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const processor = require('../library/processor');
    processor.processInBackground(doc.id);
    await audit.log({
      req, action: 'knowledge.reprocess', targetType: 'document',
      targetId: doc.id, targetLabel: doc.title,
    });
    res.json({ ok: true, message: 'Reprocessing started.' });
  } catch (err) { next(err); }
});

// ---------- Library admin ----------

router.patch('/library/:id/rename', requireAdmin, async (req, res, next) => {
  try {
    const title = (req.body && req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title required' });
    const r = await db.pool.query(
      'UPDATE library_documents SET title = $1 WHERE id = $2 RETURNING id, title',
      [title, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    await audit.log({
      req, action: 'library.rename', targetType: 'document',
      targetId: r.rows[0].id, targetLabel: title,
    });
    res.json({ ok: true, document: r.rows[0] });
  } catch (err) { next(err); }
});

router.post('/library/bulk', requireAdmin, async (req, res, next) => {
  try {
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    if (!['approve', 'unapprove', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    let affected = 0;
    if (action === 'delete') {
      const docs = await db.pool.query('SELECT storage_path FROM library_documents WHERE id = ANY($1::uuid[])', [ids]);
      for (const d of docs.rows) {
        try { require('../library/storage').removeFile(d.storage_path); } catch (_) {}
      }
      const r = await db.pool.query('DELETE FROM library_documents WHERE id = ANY($1::uuid[])', [ids]);
      affected = r.rowCount;
    } else {
      const approved = action === 'approve';
      const r = await db.pool.query(
        `UPDATE library_documents
            SET approved = $1, status = $2,
                approved_at = CASE WHEN $1 THEN now() ELSE NULL END
          WHERE id = ANY($3::uuid[])`,
        [approved, approved ? 'approved' : 'rejected', ids]
      );
      affected = r.rowCount;
      await db.pool.query(
        'UPDATE document_chunks SET approved = $1 WHERE document_id = ANY($2::uuid[])',
        [approved, ids]
      );
    }
    await audit.log({
      req, action: 'library.bulk', targetType: 'document',
      details: { action, count: affected, ids: ids.slice(0, 20) },
    });
    res.json({ ok: true, affected });
  } catch (err) { next(err); }
});

// ---------- Analytics ----------

router.get('/analytics/summary', requireAdmin, async (req, res, next) => {
  try { res.json(await db.analytics.getSummary()); }
  catch (err) { next(err); }
});

router.get('/analytics/messages-by-day', requireAdmin, async (req, res, next) => {
  try {
    const days = Math.min(90, parseInt(req.query.days, 10) || 30);
    res.json({ data: await db.analytics.getMessagesByDay(days) });
  } catch (err) { next(err); }
});

router.get('/analytics/users-by-day', requireAdmin, async (req, res, next) => {
  try {
    const days = Math.min(90, parseInt(req.query.days, 10) || 30);
    res.json({ data: await db.analytics.getUsersByDay(days) });
  } catch (err) { next(err); }
});

router.get('/analytics/providers', requireAdmin, async (req, res, next) => {
  try { res.json({ providers: await db.analytics.getProviderUsage() }); }
  catch (err) { next(err); }
});

router.get('/analytics/recent', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    res.json({ activity: await db.analytics.getRecentActivity({ limit }) });
  } catch (err) { next(err); }
});

router.get('/analytics/topics', requireAdmin, async (req, res, next) => {
  try { res.json({ topics: await db.analytics.getTopQuizTopics({ limit: 10 }) }); }
  catch (err) { next(err); }
});

// ---------- Audit log ----------

router.get('/audit', requireAdmin, async (req, res, next) => {
  try {
    const limit  = Math.min(500, parseInt(req.query.limit, 10) || 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const action  = req.query.action || null;
    const adminId = req.query.adminId || null;

    const entries = await db.auditLog.list({ limit, offset, action, adminId });
    const total   = await db.auditLog.count({ action, adminId });
    res.json({ entries, total, limit, offset });
  } catch (err) { next(err); }
});

router.get('/audit/meta', requireAdmin, async (req, res, next) => {
  try {
    const actions = await db.auditLog.distinctActions();
    const admins  = await db.auditLog.distinctAdmins();
    res.json({ actions, admins });
  } catch (err) { next(err); }
});

router.delete('/audit/old', requireAdmin, async (req, res, next) => {
  try {
    const days = Math.max(1, parseInt(req.query.days, 10) || 90);
    const removed = await db.auditLog.removeOlderThan(days);
    await audit.log({
      req, action: 'audit.cleanup', details: { days, removed },
    });
    res.json({ ok: true, removed });
  } catch (err) { next(err); }
});

// ---------- Backup ----------

router.get('/backup/export', requireAdmin, async (req, res, next) => {
  try {
    const data = await backup.exportAll();
    await audit.log({
      req, action: 'backup.export',
      details: { tables: Object.keys(data.tables).length },
    });
    const filename = 'ai-learning-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(JSON.stringify(data, null, 2));
  } catch (err) { next(err); }
});

router.post('/backup/import', requireAdmin, backupUpload.single('backup'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    let data;
    try {
      data = JSON.parse(req.file.buffer.toString('utf8'));
    } catch (err) {
      return res.status(400).json({ error: 'File is not valid JSON' });
    }
    const result = await backup.importAll(data);
    if (!result.ok) {
      return res.status(400).json({
        error: result.detail || 'Import failed',
        code: result.code,
      });
    }
    await audit.log({
      req, action: 'backup.import',
      details: { counts: result.counts },
    });
    res.json({ ok: true, counts: result.counts });
  } catch (err) { next(err); }
});

module.exports = router;