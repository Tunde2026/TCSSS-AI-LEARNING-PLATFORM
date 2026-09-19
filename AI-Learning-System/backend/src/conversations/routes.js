// Conversation routes. All require login.
// Users can only see/modify their own conversations.

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireLogin } = require('../auth');

// GET /api/conversations
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const list = await db.conversations.listByUser(req.user.id);
    res.json({ conversations: list });
  } catch (err) { next(err); }
});

// POST /api/conversations
router.post('/', requireLogin, async (req, res, next) => {
  try {
    const title = (req.body && req.body.title) || 'New conversation';
    const conversation = await db.conversations.create(req.user.id, title);
    res.status(201).json({ conversation });
  } catch (err) { next(err); }
});

// GET /api/conversations/:id
router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const list  = await db.conversations.listByUser(req.user.id);
    const owned = list.find(c => c.id === req.params.id);
    if (!owned) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await db.messages.listByConversation(req.params.id);
    res.json({ conversation: owned, messages });
  } catch (err) { next(err); }
});

// PATCH /api/conversations/:id/rename  { title }
router.patch('/:id/rename', requireLogin, async (req, res, next) => {
  try {
    const raw = (req.body && req.body.title) || '';
    const title = String(raw).trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const updated = await db.conversations.rename(req.params.id, req.user.id, title);
    if (!updated) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ conversation: updated });
  } catch (err) { next(err); }
});

// PATCH /api/conversations/:id/pin  { pinned: true|false }
router.patch('/:id/pin', requireLogin, async (req, res, next) => {
  try {
    const pinned = Boolean(req.body && req.body.pinned);
    const updated = await db.conversations.setPinned(req.params.id, req.user.id, pinned);
    if (!updated) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ conversation: updated });
  } catch (err) { next(err); }
});

// DELETE /api/conversations/:id
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const removed = await db.conversations.remove(req.params.id, req.user.id);
    if (!removed) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;