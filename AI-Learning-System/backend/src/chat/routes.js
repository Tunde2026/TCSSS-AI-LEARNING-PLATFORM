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

module.exports = router;