// ============================================================
// library/routes.js
// ------------------------------------------------------------
// Library endpoints.
//   GET    /api/library                       (logged-in: approved docs)
//   GET    /api/library/:id/download          (logged-in: download approved)
//   GET    /api/library/admin                 (admin: all docs)
//   POST   /api/library/admin/upload          (admin: upload)
//   PATCH  /api/library/admin/:id/approve
//   POST   /api/library/admin/:id/reprocess
//   DELETE /api/library/admin/:id
// ============================================================

const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const router  = express.Router();

const service = require('./service');
const storage = require('./storage');
const db      = require('../db');
const { requireLogin, requireAdmin } = require('../auth');

storage.ensureUploadDirs();

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storage.LIBRARY_DIR),
  filename: (req, file, cb) => cb(null, storage.generateFilename(file.originalname, null)),
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: storage.MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const check = storage.validateDocFile(file);
    if (!check.ok) return cb(Object.assign(new Error(check.reason), { status: 400 }));
    cb(null, true);
  },
});

// ---- Public (logged-in) ----

router.get('/', requireLogin, async (req, res, next) => {
  try { res.json({ documents: await db.library.listApproved() }); }
  catch (err) { next(err); }
});

// Download a resource
router.get('/:id/download', requireLogin, async (req, res, next) => {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // Students can only download approved docs. Admins can download anything.
    if (!doc.approved && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      return res.status(404).json({ error: 'File missing on server' });
    }

    res.download(doc.storage_path, doc.original_name || doc.filename);
  } catch (err) { next(err); }
});

// Read inline (no download prompt)
router.get('/:id/read', requireLogin, async (req, res, next) => {
  const reader = require('./reader');
  return reader.streamBook(req, res, next);
});

// ---- Admin ----

router.get('/admin', requireAdmin, async (req, res, next) => {
  try { res.json({ documents: await db.library.listAll() }); }
  catch (err) { next(err); }
});

router.post('/admin/upload', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    const result = await service.saveUpload({
      adminId: req.user.id,
      file: req.file,
      meta: {
        title: req.body.title,
        subject: req.body.subject,
        level: req.body.level,
        author: req.body.author,
      },
    });
    if (!result.ok) {
      if (req.file && req.file.path) storage.removeFile(req.file.path);
      const map = {
        NO_FILE:  [400, 'No file uploaded.'],
        BAD_TYPE: [400, 'Unsupported file type. Use PDF, DOCX, EPUB, or TXT.'],
        NO_TITLE: [400, 'A title is required.'],
      };
      const [s, m] = map[result.code] || [400, 'Upload failed.'];
      return res.status(s).json({ error: m, code: result.code });
    }
    res.status(201).json({ document: result.document });
  } catch (err) { next(err); }
});

router.patch('/admin/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const approved = Boolean(req.body && req.body.approved);
    const result = await service.setApproval(req.params.id, approved, req.user.id);
    if (!result.ok) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: result.document });
  } catch (err) { next(err); }
});

router.post('/admin/:id/reprocess', requireAdmin, async (req, res, next) => {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const processor = require('./processor');
    processor.processInBackground(doc.id);
    res.json({ ok: true, message: 'Reprocessing started.' });
  } catch (err) { next(err); }
});

router.delete('/admin/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await service.deleteDocument(req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Document not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum is 50 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  next(err);
});

module.exports = router;