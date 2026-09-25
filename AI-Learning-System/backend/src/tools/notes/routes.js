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

// POST /api/tools/notes/:id/ai  — AI transform the note
router.post('/:id/ai', requireLogin, async (req, res, next) => {
  try {
    const result = await service.aiTransform({
      userId: req.user.id,
      noteId: req.params.id,
      action: req.body.action,
      useEditedContent: req.body.useEditedContent,
      editedContent: req.body.editedContent,
    });
    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND' ? 404 :
        result.code === 'INVALID_ACTION' ? 400 :
        result.code === 'EMPTY_NOTE' ? 400 :
        result.code === 'TOO_LONG' ? 413 :
        500;
      return res.status(status).json({ error: result.code });
    }
    res.json({
      action: result.action,
      label: result.label,
      result: result.result,
      provider: result.provider,
    });
  } catch (err) { next(err); }
});

module.exports = router;