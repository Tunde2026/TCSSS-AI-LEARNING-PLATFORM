// ============================================================
// support/routes.js
// ------------------------------------------------------------
// Student-facing support routes. Mounted at /api/support.
// Admin routes live in admin/routes.js.
// ============================================================

const express = require('express');
const router  = express.Router();
const service = require('./service');
const db      = require('../db');
const { requireLogin } = require('../auth');

/* POST /api/support — submit a new ticket (public) */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, whatsapp, category, subject, body } = req.body || {};
    const result = await service.submit({
      user: req.user || null,
      name, email, whatsapp, category, subject, body,
    });
    if (!result.ok) {
      return res.status(400).json({
        error: result.detail || 'Could not submit ticket.',
        code: result.code,
      });
    }
    res.status(201).json({ ticket: result.ticket });
  } catch (err) { next(err); }
});

/* GET /api/support/mine — logged-in student's tickets */
router.get('/mine', requireLogin, async (req, res, next) => {
  try {
    const tickets = await db.support.listTicketsForUser(req.user.id);
    const unread  = await db.support.countUnreadForUser(req.user.id);
    res.json({ tickets, unread });
  } catch (err) { next(err); }
});

/* GET /api/support/team — team contact list for urgent help */
router.get('/team', function (req, res) {
  res.json({ team: require('./team') });
});

/* GET /api/support/unread/count — sidebar badge */
router.get('/unread/count', requireLogin, async (req, res, next) => {
  try {
    const unread = await db.support.countUnreadForUser(req.user.id);
    res.json({ unread });
  } catch (err) { next(err); }
});

/* PATCH /api/support/message/:id — edit own message */
router.patch('/message/:id', requireLogin, async (req, res, next) => {
  try {
    const result = await service.editMessage({
      messageId: req.params.id,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin',
      newBody: req.body && req.body.body,
    });
    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND' ? 404 :
        result.code === 'FORBIDDEN' ? 403 :
        result.code === 'DELETED'   ? 410 :
        result.code === 'TOO_LONG'  ? 413 :
        400;
      return res.status(status).json({ error: result.code });
    }
    res.json({ message: result.message });
  } catch (err) { next(err); }
});

/* DELETE /api/support/message/:id — delete own message */
router.delete('/message/:id', requireLogin, async (req, res, next) => {
  try {
    const result = await service.deleteMessage({
      messageId: req.params.id,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin',
    });
    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND' ? 404 :
        result.code === 'FORBIDDEN' ? 403 :
        result.code === 'DELETED'   ? 410 :
        400;
      return res.status(status).json({ error: result.code });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* GET /api/support/:id — one ticket + messages */
router.get('/:id', async (req, res, next) => {
  try {
    const isAdmin = !!(req.user && req.user.role === 'admin');
    const result = await service.getTicket({
      ticketId: req.params.id,
      userId: req.user ? req.user.id : null,
      isAdmin,
    });
    if (!result.ok) {
      const code = result.code === 'NOT_FOUND' ? 404 : 403;
      return res.status(code).json({ error: result.code });
    }
    res.json({ ticket: result.ticket, messages: result.messages });
  } catch (err) { next(err); }
});

/* POST /api/support/:id/reply — student reply */
router.post('/:id/reply', requireLogin, async (req, res, next) => {
  try {
    const result = await service.studentReply({
      ticketId: req.params.id,
      userId: req.user.id,
      body: req.body && req.body.body,
    });
    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND' ? 404 :
        result.code === 'FORBIDDEN' ? 403 :
        result.code === 'CLOSED'    ? 409 :
        400;
      return res.status(status).json({ error: result.code });
    }
    res.status(201).json({ message: result.message });
  } catch (err) { next(err); }
});

module.exports = router;