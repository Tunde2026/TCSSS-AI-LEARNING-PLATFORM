// AI routes.
// NOTE: auth is not wired yet. Add requireLogin when the auth module is done.

const express = require('express');
const router = express.Router();
const { chat, _debugState } = require('./gateway');
const logger = require('../core/logger');

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  // Basic shape validation — reject obviously malformed input early.
  for (const m of messages) {
    if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
      return res.status(400).json({ error: 'each message needs role and content' });
    }
  }

  try {
    const result = await chat({ messages });
    // TODO: remove `provider` from the response before production.
    res.json({
      reply: result.text,
      provider: result.provider,
    });
  } catch (err) {
    logger.error('[ai/chat]', err.message, err.attempts || []);

    if (err.message === 'REQUEST_REJECTED') {
      return res.status(400).json({ error: 'The request was rejected by the model.' });
    }
    if (err.message === 'NO_PROVIDERS_AVAILABLE') {
      return res.status(503).json({ error: 'No AI providers are configured.' });
    }
    if (err.message === 'ALL_PROVIDERS_FAILED') {
      return res.status(503).json({ error: 'AI temporarily unavailable. Please try again.' });
    }
    res.status(500).json({ error: 'Unexpected AI error.' });
  }
});

// GET /api/ai/status — dev-only health view
router.get('/status', (req, res) => {
  res.json(_debugState());
});

module.exports = router;