// ============================================================
// conversations/editRoutes.js
// Edits a user's own message and removes every message that
// came after it. Mounted at /api/conversations so it lives
// alongside the main conversations router.
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../core/logger');

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.post('/:conversationId/edit-message', requireLogin, async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    const { index, content } = req.body || {};

    // ---- Validate ----
    if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
      return res.status(400).json({ error: 'Invalid message index.' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required.' });
    }
    const cleanContent = content.trim();
    if (!cleanContent) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (cleanContent.length > 10000) return res.status(400).json({ error: 'Message is too long.' });

    // ---- Verify conversation ownership ----
    const conv = await db.pool.query(
      'SELECT id, user_id FROM conversations WHERE id = $1 LIMIT 1',
      [conversationId]
    );
    if (!conv.rowCount) return res.status(404).json({ error: 'Conversation not found.' });
    if (conv.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You cannot edit this conversation.' });
    }

    // ---- Load all messages in order ----
    const msgs = await db.pool.query(
      `SELECT id, role, content, created_at
         FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC, id ASC`,
      [conversationId]
    );

    if (index >= msgs.rows.length) {
      return res.status(400).json({ error: 'Message index out of range.' });
    }

    const target = msgs.rows[index];
    if (target.role !== 'user') {
      return res.status(400).json({ error: 'You can only edit your own messages.' });
    }

    // ---- Update the target message ----
    await db.pool.query(
      'UPDATE messages SET content = $1 WHERE id = $2',
      [cleanContent, target.id]
    );

    // ---- Delete all messages after the target ----
    const idsToDelete = msgs.rows.slice(index + 1).map(function (m) { return m.id; });
    let removed = 0;
    if (idsToDelete.length) {
      const r = await db.pool.query(
        'DELETE FROM messages WHERE id = ANY($1::uuid[])',
        [idsToDelete]
      );
      removed = r.rowCount;
    }

    // ---- Touch the conversation's updated_at ----
    await db.pool.query(
      'UPDATE conversations SET updated_at = now() WHERE id = $1',
      [conversationId]
    );

    logger.info('[conversations] edited message #' + index +
                ' in ' + conversationId +
                ' (' + removed + ' follow-ups removed)');

    res.json({
      ok: true,
      removed: removed,
      remaining_count: index + 1,
      message: {
        id: target.id,
        role: 'user',
        content: cleanContent,
      },
    });
  } catch (err) {
    logger.error('[conversations] edit-message: ' + err.message);
    next(err);
  }
});

module.exports = router;
