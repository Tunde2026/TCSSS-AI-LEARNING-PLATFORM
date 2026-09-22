const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const service = require('./service');
const storage = require('./storage');
const reader  = require('./reader');
const db      = require('../db');
const { requireLogin, requireAdmin } = require('../auth');

storage.ensureUploadDirs();

const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, storage.LIBRARY_DIR); },
  filename: function (req, file, cb) { cb(null, storage.generateFilename(file.originalname, null)); },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: storage.MAX_SIZE_BYTES },
  fileFilter: function (req, file, cb) {
    const check = storage.validateDocFile(file);
    if (!check.ok) return cb(Object.assign(new Error(check.reason), { status: 400 }));
    cb(null, true);
  },
});

router.get('/', requireLogin, async function (req, res, next) {
  try { res.json({ documents: await db.library.listApproved() }); }
  catch (err) { next(err); }
});

router.get('/:id/read', requireLogin, function (req, res, next) {
  return reader.streamBook(req, res, next);
});

router.get('/:id/download', requireLogin, async function (req, res, next) {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!doc.approved && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) return res.status(404).json({ error: 'File missing' });

    var originalName = doc.original_name || doc.filename || 'book';
    var ext = path.extname(originalName).toLowerCase();
    if (!ext) {
      if (doc.mime_type && doc.mime_type.indexOf('epub') !== -1) ext = '.epub';
      else if (doc.mime_type && doc.mime_type.indexOf('pdf') !== -1) ext = '.pdf';
      else if (doc.mime_type && doc.mime_type.indexOf('text/plain') !== -1) ext = '.txt';
      else ext = '';
    }
    var safeName = originalName.replace(/[^\w\-\. ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (ext && !safeName.toLowerCase().endsWith(ext.toLowerCase())) safeName += ext;
    if (!safeName) safeName = 'book' + ext;

    res.setHeader('Content-Disposition', 'attachment; filename="' + safeName.replace(/"/g, '') + '"');
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');

    const stream = fs.createReadStream(doc.storage_path);
    stream.on('error', function (err) { next(err); });
    stream.pipe(res);
  } catch (err) { next(err); }
});

router.get('/admin', requireAdmin, async function (req, res, next) {
  try { res.json({ documents: await db.library.listAll() }); }
  catch (err) { next(err); }
});

router.post('/admin/upload', requireAdmin, upload.single('file'), async function (req, res, next) {
  try {
    const result = await service.saveUpload({
      adminId: req.user.id,
      file: req.file,
      meta: { title: req.body.title, subject: req.body.subject, level: req.body.level, author: req.body.author },
    });
    if (!result.ok) {
      if (req.file && req.file.path) storage.removeFile(req.file.path);
      const map = {
        NO_FILE:  [400, 'No file uploaded.'],
        BAD_TYPE: [400, 'Unsupported file type.'],
        NO_TITLE: [400, 'A title is required.'],
      };
      const entry = map[result.code] || [400, 'Upload failed.'];
      return res.status(entry[0]).json({ error: entry[1], code: result.code });
    }
    res.status(201).json({ document: result.document });
  } catch (err) { next(err); }
});

router.patch('/admin/:id/approve', requireAdmin, async function (req, res, next) {
  try {
    const approved = Boolean(req.body && req.body.approved);
    const result = await service.setApproval(req.params.id, approved, req.user.id);
    if (!result.ok) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: result.document });
  } catch (err) { next(err); }
});

router.post('/admin/:id/reprocess', requireAdmin, async function (req, res, next) {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const processor = require('./processor');
    processor.processInBackground(doc.id);
    res.json({ ok: true, message: 'Reprocessing started.' });
  } catch (err) { next(err); }
});

router.delete('/admin/:id', requireAdmin, async function (req, res, next) {
  try {
    const result = await service.deleteDocument(req.params.id);
    if (!result.ok) return res.status(404).json({ error: 'Document not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.use(function (err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum is 100 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  next(err);
});

module.exports = router;
