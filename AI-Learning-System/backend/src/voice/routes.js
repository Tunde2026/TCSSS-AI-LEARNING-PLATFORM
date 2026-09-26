// ============================================================
// voice/routes.js
// ------------------------------------------------------------
// POST /api/voice/transcribe
// ============================================================

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../auth');
const logger = require('../core/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/transcribe', requireLogin, upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const result = await service.transcribe(req.file.buffer, req.file.mimetype);

    if (!result.ok) {
      const map = {
        NO_AUDIO:              [400, 'No audio received.'],
        TOO_SHORT:             [400, 'Recording was too short.'],
        TOO_LARGE:             [413, 'Recording is too large.'],
        NO_PROVIDER:           [503, 'Voice transcription is not configured on this server.'],
        ALL_PROVIDERS_FAILED:  [503, 'Voice transcription is temporarily unavailable. Please type your message instead.'],
      };
      const [status, msg] = map[result.code] || [500, 'Could not transcribe audio.'];
      logger.warn('[voice/route] ' + result.code + (result.detail ? ' (' + result.detail + ')' : ''));
      return res.status(status).json({ error: msg, code: result.code });
    }

    res.json({ text: result.text, provider: result.provider });
  } catch (err) { next(err); }
});

module.exports = router;