const express = require('express');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../../auth');

// GET /api/tools/notes?search=...
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim() || undefined;
    const notes = await service.list(req.user.id, { search });
    res.json({ notes });
  } catch (err) { next(err); }
});

// POST /api/tools/notes
router.post('/', requireLogin, async (req, res, next) => {
  try {
    const result = await service.create(req.user.id, req.body || {});
    if (!result.ok) return res.status(400).json({ error: 'Invalid note data' });
    res.status(201).json({ note: result.note });
  } catch (err) { next(err); }
});

// GET /api/tools/notes/:id
router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const note = await service.get(req.user.id, req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ note });
  } catch (err) { next(err); }
});

// PATCH /api/tools/notes/:id
router.patch('/:id', requireLogin, async (req, res, next) => {
  try {
    const result = await service.update(req.user.id, req.params.id, req.body || {});
    if (!result.ok) {
      if (result.code === 'NOT_FOUND') return res.status(404).json({ error: 'Note not found' });
      return res.status(400).json({ error: 'Title too long' });
    }
    res.json({ note: result.note });
  } catch (err) { next(err); }
});

// DELETE /api/tools/notes/:id
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const result = await service.remove(req.user.id, req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Note not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;