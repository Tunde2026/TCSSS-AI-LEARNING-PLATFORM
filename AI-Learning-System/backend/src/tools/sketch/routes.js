// ============================================================
// tools/sketch/routes.js
// ------------------------------------------------------------
// Express router for Sketch. Mounted at /api/tools/sketch.
// ============================================================

const express = require('express');
const router  = express.Router();

const service = require('./service');
const db      = require('../../db');
const { requireLogin } = require('../../auth');

function statusFor(code) {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'FORBIDDEN') return 403;
  return 400;
}

/* GET /api/tools/sketch — list my sketches */
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const r = await service.list({ userId: req.user.id });
    res.json({ sketches: r.sketches });
  } catch (err) { next(err); }
});

/* POST /api/tools/sketch — save a new sketch */
router.post('/', requireLogin, async (req, res, next) => {
  try {
    const r = await service.save({
      userId: req.user.id,
      title: req.body.title,
      subject: req.body.subject,
      rawInput: req.body.rawInput,
      renderedHtml: req.body.renderedHtml,
      renderedText: req.body.renderedText,
      kind: req.body.kind,
    });
    if (!r.ok) return res.status(statusFor(r.code)).json({ error: 'Could not save.', code: r.code });
    res.status(201).json({ sketch: r.sketch });
  } catch (err) { next(err); }
});

/* GET /api/tools/sketch/:id — one sketch */
router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const s = await db.sketches.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    if (s.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ sketch: s });
  } catch (err) { next(err); }
});

/* PATCH /api/tools/sketch/:id — update */
router.patch('/:id', requireLogin, async (req, res, next) => {
  try {
    const r = await service.update({
      userId: req.user.id,
      id: req.params.id,
      fields: req.body || {},
    });
    if (!r.ok) return res.status(statusFor(r.code)).json({ error: 'Could not update.', code: r.code });
    res.json({ sketch: r.sketch });
  } catch (err) { next(err); }
});

/* DELETE /api/tools/sketch/:id */
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const r = await service.remove({ userId: req.user.id, id: req.params.id });
    if (!r.ok) return res.status(statusFor(r.code)).json({ error: 'Could not delete.', code: r.code });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* POST /api/tools/sketch/generate — AI generates a formula */
router.post('/generate', requireLogin, async (req, res, next) => {
  try {
    const r = await service.generateFormula({ query: req.body.query });
    if (!r.ok) return res.status(400).json({ error: 'Could not generate.', code: r.code });
    res.json(r.result);
  } catch (err) { next(err); }
});

/* POST /api/tools/sketch/solve — AI format + solve an expression */
router.post('/solve', requireLogin, async (req, res, next) => {
  try {
    const r = await service.solveExpression({ expression: req.body.expression });
    if (!r.ok) return res.status(400).json({
      error: 'Could not solve.',
      code: r.code,
      detail: r.detail,
    });
    res.json(r.result);
  } catch (err) { next(err); }
});
module.exports = router;