// ============================================================
// dm/routes.js — direct messaging
// Mounted at /api/dm
// ============================================================
const express = require('express');
const router  = express.Router();
const service = require('./service');

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/search', requireLogin, async (req, res, next) => {
  try {
    const r = await service.search(req.query.q, req.user.id);
    if (!r.ok) return res.status(400).json({ error: r.code });
    res.json({ users: r.users });
  } catch (err) { next(err); }
});

router.post('/start', requireLogin, async (req, res, next) => {
  try {
    const r = await service.startConversation({
      userId: req.user.id,
      identifier: req.body.identifier,
    });
    if (!r.ok) {
      const status = r.code === 'USER_NOT_FOUND' ? 404 : 400;
      return res.status(status).json({
        error: r.message || r.code,
        code: r.code,
        inviteUrl: r.inviteUrl || null,
      });
    }
    res.json({ conversation: r.conversation, other: r.other });
  } catch (err) { next(err); }
});

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const r = await service.listMine(req.user.id);
    res.json({ conversations: r.conversations });
  } catch (err) { next(err); }
});

router.get('/unread/count', requireLogin, async (req, res, next) => {
  try {
    const r = await service.unreadCount(req.user.id);
    res.json({ unread: r.unread });
  } catch (err) { next(err); }
});

router.get('/folders', requireLogin, async (req, res, next) => {
  try {
    const out = await service.listFolders(req.user.id);
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/folders', requireLogin, async (req, res, next) => {
  try {
    const out = await service.createFolder({
      userId: req.user.id,
      name: req.body && req.body.name,
      icon: req.body && req.body.icon,
    });
    if (!out.ok) return res.status(400).json({ error: out.code });
    res.status(201).json({ folder: out.folder });
  } catch (err) { next(err); }
});

router.patch('/folders/:id', requireLogin, async (req, res, next) => {
  try {
    const out = await service.renameFolder({
      userId: req.user.id,
      folderId: req.params.id,
      name: req.body && req.body.name,
      icon: req.body && req.body.icon,
    });
    if (!out.ok) return res.status(404).json({ error: out.code });
    res.json({ folder: out.folder });
  } catch (err) { next(err); }
});

router.delete('/folders/:id', requireLogin, async (req, res, next) => {
  try {
    const out = await service.deleteFolder({
      userId: req.user.id,
      folderId: req.params.id,
    });
    if (!out.ok) return res.status(404).json({ error: out.code });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/folder', requireLogin, async (req, res, next) => {
  try {
    const out = await service.moveToFolder({
      userId: req.user.id,
      conversationId: req.params.id,
      folderId: req.body && req.body.folderId,
    });
    if (!out.ok) return res.status(400).json({ error: out.code });
    res.json({ ok: true });
  } catch (err) { next(err); }
});


/* ============================================================
   GROUPS — must come BEFORE /:id routes (Express rule 8)
   ============================================================ */

router.post('/groups', requireLogin, async (req, res, next) => {
  try {
    const out = await service.createGroup({
      userId: req.user.id,
      name: req.body && req.body.name,
      avatarEmoji: req.body && req.body.avatarEmoji,
      memberIds: (req.body && req.body.memberIds) || [],
    });
    if (!out.ok) return res.status(400).json({ error: out.code });
    res.status(201).json({ conversationId: out.conversationId });
  } catch (err) { next(err); }
});

router.post('/:id/members', requireLogin, async (req, res, next) => {
  try {
    const out = await service.addMember({
      userId: req.user.id,
      conversationId: req.params.id,
      targetId: req.body && req.body.userId,
    });
    if (!out.ok) {
      const status = out.code === 'FORBIDDEN' || out.code === 'NOT_ADMIN' ? 403 : 400;
      return res.status(status).json({ error: out.code });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id/members/:userId', requireLogin, async (req, res, next) => {
  try {
    // If the user is removing themselves → leaveGroup
    if (req.params.userId === req.user.id) {
      const out = await service.leaveGroup({
        userId: req.user.id,
        conversationId: req.params.id,
      });
      if (!out.ok) return res.status(400).json({ error: out.code });
      return res.json({ ok: true, left: true });
    }
    // Otherwise admin kick
    const out = await service.kickMember({
      userId: req.user.id,
      conversationId: req.params.id,
      targetId: req.params.userId,
    });
    if (!out.ok) return res.status(403).json({ error: out.code });
    res.json({ ok: true, kicked: true });
  } catch (err) { next(err); }
});

router.patch('/:id/group', requireLogin, async (req, res, next) => {
  try {
    const out = await service.renameGroup({
      userId: req.user.id,
      conversationId: req.params.id,
      name: req.body && req.body.name,
      avatarEmoji: req.body && req.body.avatarEmoji,
    });
    if (!out.ok) return res.status(403).json({ error: out.code });
    res.json({ group: out.group });
  } catch (err) { next(err); }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const r = await service.getConversation({
      userId: req.user.id,
      conversationId: req.params.id,
    });
    if (!r.ok) return res.status(r.code === 'FORBIDDEN' ? 403 : 404).json({ error: r.code });
    res.json({ members: r.members, messages: r.messages });
  } catch (err) { next(err); }
});

router.post('/:id/send', requireLogin, async (req, res, next) => {
  try {
    const r = await service.sendMessage({
      userId: req.user.id,
      conversationId: req.params.id,
      body: req.body && req.body.body,
      replyToId: req.body && req.body.replyToId,
    });
    if (!r.ok) {
      const status = r.code === 'FORBIDDEN' ? 403 : r.code === 'TOO_LONG' ? 413 : 400;
      return res.status(status).json({ error: r.code });
    }
    res.status(201).json({ message: r.message, aiMessage: r.aiMessage });
  } catch (err) { next(err); }
});

router.patch('/:id/message/:msgId', requireLogin, async (req, res, next) => {
  try {
    const r = await service.editMessage({
      userId: req.user.id,
      conversationId: req.params.id,
      messageId: req.params.msgId,
      newBody: req.body && req.body.body,
    });
    if (!r.ok) {
      const status = r.code === 'FORBIDDEN' ? 403 : r.code === 'EMPTY' ? 400 : 404;
      return res.status(status).json({ error: r.code });
    }
    res.json({ message: r.message });
  } catch (err) { next(err); }
});

router.delete('/:id/message/:msgId', requireLogin, async (req, res, next) => {
  try {
    const r = await service.deleteMessage({
      userId: req.user.id,
      conversationId: req.params.id,
      messageId: req.params.msgId,
    });
    if (!r.ok) return res.status(r.code === 'FORBIDDEN' ? 403 : 404).json({ error: r.code });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/message/:msgId/react', requireLogin, async (req, res, next) => {
  try {
    const r = await service.reactMessage({
      userId: req.user.id,
      conversationId: req.params.id,
      messageId: req.params.msgId,
      emoji: req.body && req.body.emoji,
    });
    if (!r.ok) {
      const status = r.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ error: r.code });
    }
    res.json({ ok: true, removed: r.removed });
  } catch (err) { next(err); }
});

router.patch('/:id/pin', requireLogin, async (req, res, next) => {
  try {
    const r = await service.setPinned({
      userId: req.user.id,
      conversationId: req.params.id,
      pinned: req.body && req.body.pinned,
    });
    if (!r.ok) return res.status(r.code === 'FORBIDDEN' ? 403 : 404).json({ error: r.code });
    res.json({ ok: true, pinned: r.pinned });
  } catch (err) { next(err); }
});

module.exports = router;
