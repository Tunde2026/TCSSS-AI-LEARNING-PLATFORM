const express = require('express');
const router  = express.Router();
const service = require('./service');
const db      = require('../../db');
const { requireLogin } = require('../../auth');

router.post('/generate', requireLogin, async (req, res, next) => {
  try {
    const { topic, count, difficulty, subject, description } = req.body || {};
    const result = await service.generate({
      userId: req.user.id, topic, count, difficulty, subject, description,
    });
    if (!result.ok) {
      const map = {
        INVALID_TOPIC:     [400, 'Please provide a topic.'],
        AI_FAILED:         [503, 'The AI is temporarily unavailable.'],
        INVALID_AI_OUTPUT: [502, 'The AI returned an unusable response.'],
      };
      const [s, m] = map[result.code] || [400, 'Could not generate practice set.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    res.status(201).json({ set: result.set });
  } catch (err) { next(err); }
});

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const sets = await db.practice.listSets(req.user.id);
    res.json({ sets });
  } catch (err) { next(err); }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const set = await db.practice.findSet(req.params.id);
    if (!set || set.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Practice set not found' });
    }
    res.json({ set });
  } catch (err) { next(err); }
});

router.patch('/:id/description', requireLogin, async (req, res, next) => {
  try {
    const description = (req.body && req.body.description != null)
      ? String(req.body.description).slice(0, 500)
      : null;
    const updated = await db.practice.setDescription(req.params.id, req.user.id, description);
    if (!updated) return res.status(404).json({ error: 'Practice set not found' });
    res.json({ set: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const ok = await db.practice.removeSet(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;