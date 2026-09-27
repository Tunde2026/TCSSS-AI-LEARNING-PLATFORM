// ============================================================
// announcements/routes.js — student-facing routes
// Mounted at /api/announcements
// ============================================================
const express = require('express');
const router = express.Router();
const service = require('./service');

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/active', requireLogin, async (req, res, next) => {
  try {
    const announcements = await service.listActiveForUser(req.user);
    res.json({ announcements });
  } catch (err) { next(err); }
});

// Record a view the moment the popup/banner is shown on screen.
router.post('/:id/view', requireLogin, async (req, res, next) => {
  try {
    const mode = req.body && req.body.display_mode;
    const result = await service.recordView(req.params.id, req.user.id, mode);
    if (!result.ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/dismiss', requireLogin, async (req, res, next) => {
  try {
    const result = await service.dismiss(req.params.id, req.user.id);
    if (!result.ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
