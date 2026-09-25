// ============================================================
// tools/theory/routes.js
// ------------------------------------------------------------
// Express router for Theory. Mounted at /api/tools/theory.
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

/* GET /api/tools/theory — list my sets */
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const sets = await db.theory.listSetsForUser(req.user.id);
    res.json({ sets });
  } catch (err) { next(err); }
});

/* POST /api/tools/theory/generate — AI creates a set */
router.post('/generate', requireLogin, async (req, res, next) => {
  try {
    const { topic, count, difficulty, subject, description } = req.body || {};
    const result = await service.generate({
      userId: req.user.id,
      topic,
      count,
      difficulty,
      subject,
      description,
    });
    if (!result.ok) {
      return res.status(statusFor(result.code)).json({
        error: 'Could not generate theory questions.',
        code: result.code,
        detail: result.detail,
      });
    }
    res.status(201).json({ set: result.set });
  } catch (err) { next(err); }
});

/* POST /api/tools/theory/manual — student-created set */
router.post('/manual', requireLogin, async (req, res, next) => {
  try {
    const result = await service.createManual({
      userId: req.user.id,
      title: req.body.title,
      subject: req.body.subject,
      topic: req.body.topic,
      difficulty: req.body.difficulty,
      questions: req.body.questions,
      description: req.body.description,
    });
    if (!result.ok) {
      return res.status(statusFor(result.code)).json({
        error: 'Could not create set.',
        code: result.code,
        detail: result.detail,
      });
    }
    res.status(201).json({ set: result.set });
  } catch (err) { next(err); }
});

/* GET /api/tools/theory/:id — read a set (answers hidden) */
router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const set = await db.theory.findFullSet(req.params.id);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    if (set.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const safeQuestions = (set.questions || []).map(function (q) {
      return {
        id: q.id,
        position: q.position,
        template: q.template,
        hint: q.hint || null,
      };
    });

    res.json({
      set: {
        id: set.id,
        title: set.title,
        subject: set.subject,
        topic: set.topic,
        difficulty: set.difficulty,
        description: set.description || null,
        questions: safeQuestions,
      },
    });
  } catch (err) { next(err); }
});

/* PATCH /api/tools/theory/:id — rename */
router.patch('/:id', requireLogin, async (req, res, next) => {
  try {
    const title = (req.body && req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title required' });
    const updated = await db.theory.renameSet(req.params.id, req.user.id, title);
    if (!updated) return res.status(404).json({ error: 'Set not found' });
    res.json({ set: updated });
  } catch (err) { next(err); }
});

/* PATCH /api/tools/theory/:id/description */
router.patch('/:id/description', requireLogin, async (req, res, next) => {
  try {
    const r = await service.setDescription({
      setId: req.params.id,
      userId: req.user.id,
      description: req.body.description,
    });
    if (!r.ok) return res.status(statusFor(r.code)).json({ error: 'Could not update.' });
    res.json({ set: r.set });
  } catch (err) { next(err); }
});

/* POST /api/tools/theory/:id/attempt — grade */
router.post('/:id/attempt', requireLogin, async (req, res, next) => {
  try {
    const result = await service.gradeAttempt({
      setId: req.params.id,
      userId: req.user.id,
      answers: req.body.answers,
      timeTakenSeconds: req.body.timeTakenSeconds,
    });
    if (!result.ok) {
      return res.status(statusFor(result.code)).json({
        error: 'Could not grade attempt.',
        code: result.code,
      });
    }
    res.json(result);
  } catch (err) { next(err); }
});

/* GET /api/tools/theory/:id/attempts */
router.get('/:id/attempts', requireLogin, async (req, res, next) => {
  try {
    const attempts = await db.theory.listAttemptsForSet(req.params.id, req.user.id);
    res.json({ attempts });
  } catch (err) { next(err); }
});

/* DELETE /api/tools/theory/:id */
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const result = await service.removeSet({
      setId: req.params.id,
      userId: req.user.id,
    });
    if (!result.ok) return res.status(statusFor(result.code)).json({ error: 'Could not delete.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;