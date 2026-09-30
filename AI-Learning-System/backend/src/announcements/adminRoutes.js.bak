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

/* ============================================================
   ANNOUNCEMENT REPLIES — admin inbox
   ============================================================ */

router.get('/replies', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.announcementReplies.listAll({
      filter: req.query.filter || 'inbox',
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/replies/unread/count', requireAdmin, async (req, res, next) => {
  try {
    const unread = await db.announcementReplies.countUnread();
    res.json({ unread });
  } catch (err) { next(err); }
});

router.get('/:id/replies', requireAdmin, async (req, res, next) => {
  try {
    const announcement = await service.getById(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Not found' });
    const replies = await db.announcementReplies.listForAnnouncement(req.params.id, {
      includeArchived: req.query.archived === '1',
    });
    res.json({ announcement, replies });
  } catch (err) { next(err); }
});

router.patch('/replies/:id/read', requireAdmin, async (req, res, next) => {
  try {
    const read = req.body && req.body.read !== undefined ? !!req.body.read : true;
    const updated = await db.announcementReplies.setRead(req.params.id, read);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    await audit.log({
      req, action: 'announcement_reply.mark_read',
      targetType: 'announcement_reply', targetId: req.params.id,
      details: { read },
    });
    res.json({ reply: updated });
  } catch (err) { next(err); }
});

router.patch('/replies/:id/archive', requireAdmin, async (req, res, next) => {
  try {
    const archived = req.body && req.body.archived !== undefined ? !!req.body.archived : true;
    const updated = await db.announcementReplies.setArchived(req.params.id, archived);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    await audit.log({
      req, action: archived ? 'announcement_reply.archive' : 'announcement_reply.unarchive',
      targetType: 'announcement_reply', targetId: req.params.id,
    });
    res.json({ reply: updated });
  } catch (err) { next(err); }
});

router.delete('/replies/:id', requireAdmin, async (req, res, next) => {
  try {
    const ok = await db.announcementReplies.softDelete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    await audit.log({
      req, action: 'announcement_reply.delete',
      targetType: 'announcement_reply', targetId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/replies/bulk', requireAdmin, async (req, res, next) => {
  try {
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    if (!['read', 'unread', 'archive', 'unarchive', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'invalid action' });
    }
    const affected = await db.announcementReplies.bulkAction(ids, action);
    await audit.log({
      req, action: 'announcement_reply.bulk_' + action,
      targetType: 'announcement_reply',
      details: { count: affected, ids: ids.slice(0, 20) },
    });
    res.json({ ok: true, affected });
  } catch (err) { next(err); }
});


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
