// ============================================================
// voice/routes.js
// ------------------------------------------------------------

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const service = require('./service');
const { requireLogin } = require('../auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },   // 25 MB per clip
});

// POST /api/voice/transcribe
router.post('/transcribe', requireLogin, upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio uploaded.', code: 'NO_AUDIO' });
    }

    const result = await service.transcribe({
      buffer:   req.file.buffer,
      mimetype: req.file.mimetype,
      model:    (req.body && req.body.model) || null,
    });

    if (!result.ok) {
      const map = {
        NO_AUDIO:           [400, 'No audio uploaded.'],
        TOO_LARGE:          [400, 'Audio is too large. Maximum 25 MB.'],
        WHISPER_NOT_FOUND:  [503, 'Speech-to-text is not available on this server.'],
        TIMEOUT:            [504, 'Transcription timed out. Try a shorter clip.'],
        TRANSCRIBE_FAILED:  [500, 'Could not transcribe the audio.'],
        NO_OUTPUT:          [500, 'Transcription produced no output.'],
        UNEXPECTED:         [500, 'Unexpected transcription error.'],
      };
      const [s, m] = map[result.code] || [500, 'Transcription failed.'];
      return res.status(s).json({ error: m, code: result.code });
    }

    res.json({ text: result.text });
  } catch (err) { next(err); }
});

// GET /api/voice/status — dev-only check
router.get('/status', requireLogin, async (req, res) => {
  const available = await service.isAvailable();
  res.json({
    available,
    model: service.DEFAULT_MODEL,
    command: process.env.WHISPER_CMD || 'whisper',
  });
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Audio is too large. Maximum 25 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;