// ============================================================
// announcements/adminRoutes.js
// Mounted at /api/admin/announcements
// ============================================================
const express = require('express');
const router = express.Router();
const service = require('./service');
const { requireAdmin } = require('../auth');
const core = require('../core');
const { audit } = core;

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const announcements = await service.listAll();
    res.json({ announcements });
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.create(req.body || {}, req.user.id);
    if (!result.ok) return res.status(400).json({ error: (result.errors || ['Invalid']).join(' '), code: result.code });
    await audit.log({
      req, action: 'announcement.create', targetType: 'announcement',
      targetId: result.announcement.id, targetLabel: result.announcement.title,
    });
    res.status(201).json({ announcement: result.announcement });
  } catch (err) { next(err); }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.update(req.params.id, req.body || {});
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: (result.errors || ['Invalid']).join(' '), code: result.code });
    }
    await audit.log({
      req, action: 'announcement.update', targetType: 'announcement',
      targetId: result.announcement.id, targetLabel: result.announcement.title,
    });
    res.json({ announcement: result.announcement });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.remove(req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Not found' });
    await audit.log({
      req, action: 'announcement.delete', targetType: 'announcement',
      targetId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ---------- Viewers ---------- */
router.get('/:id/views', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.listViewers(req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Not found' });
    await audit.log({
      req, action: 'announcement.view_viewers', targetType: 'announcement',
      targetId: req.params.id, targetLabel: result.announcement.title,
      details: { viewers: result.stats.unique_viewers },
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/:id/views', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.clearViews(req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Not found' });
    await audit.log({
      req, action: 'announcement.clear_views', targetType: 'announcement',
      targetId: req.params.id, details: { removed: result.removed },
    });
    res.json({ ok: true, removed: result.removed });
  } catch (err) { next(err); }
});

module.exports = router;
