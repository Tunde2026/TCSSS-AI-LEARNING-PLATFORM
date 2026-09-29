const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const attachments = require('./attachments');
const db = require('../db');
const { requireLogin } = require('../auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// POST /api/chat/attachments — upload a file before sending the message
router.post('/attachments', requireLogin, upload.single('file'), async (req, res, next) => {
  try {
    const result = await attachments.saveUpload({
      userId: req.user.id,
      file: req.file,
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.detail || 'Upload failed.' });
    }
    res.status(201).json({ attachment: result.attachment });
  } catch (err) { next(err); }
});

// GET /api/chat/attachments/:id — poll extraction status
router.get('/attachments/:id', requireLogin, async (req, res, next) => {
  try {
    const att = await db.chatAttachments.findById(req.params.id, req.user.id);
    if (!att) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: att.id,
      original_name: att.original_name,
      extraction_status: att.extraction_status,
      size_bytes: att.size_bytes,
    });
  } catch (err) { next(err); }
});

// DELETE /api/chat/attachments/:id — remove before sending
router.delete('/attachments/:id', requireLogin, async (req, res, next) => {
  try {
    const att = await db.chatAttachments.findById(req.params.id, req.user.id);
    if (!att) return res.status(404).json({ error: 'Not found' });
    try { require('fs').unlinkSync(att.storage_path); } catch (_) {}
    await db.chatAttachments.remove(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});


/* ---------- Image text extraction ---------- */
router.post('/extract/:attachmentId', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const db = require('../db');
    const fsx = require('fs');
    const vision = require('../ai/vision');
    const logger = require('../core/logger');

    const att = (await db.pool.query(
      'SELECT * FROM chat_attachments WHERE id = module.exports = router; AND user_id = $2 LIMIT 1',
      [req.params.attachmentId, req.user.id]
    )).rows[0];

    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    const mime = att.mime_type || '';
    if (mime.indexOf('image/') !== 0) {
      return res.status(400).json({ error: 'Not an image' });
    }

    const filePath = att.storage_path;
    if (!filePath) return res.status(400).json({ error: 'No storage path' });

    let buf;
    try { buf = fsx.readFileSync(filePath); }
    catch (e) { return res.status(404).json({ error: 'File missing on disk' }); }

    const v = await vision.extractText({
      images: [{ mimetype: mime, base64: buf.toString('base64') }],
    });

    if (!v.ok) {
      return res.status(503).json({
        error: 'Extraction service unavailable',
        code: v.code,
        hint: 'Check OpenAI credits or install a local vision model: ollama pull llava:7b',
      });
    }

    // Save extracted text on the attachment so we don't re-run it
    await db.pool.query(
      'UPDATE chat_attachments SET extracted_text = module.exports = router;, extraction_status = $2 WHERE id = $3',
      [v.text, 'ready', att.id]
    ).catch(function () {});

    logger.info('[extract] attachment ' + att.id + ' -> ' + v.text.length + ' chars via ' + v.provider);
    res.json({ ok: true, text: v.text, provider: v.provider });
  } catch (err) {
    next(err);
  }
});

module.exports = router;