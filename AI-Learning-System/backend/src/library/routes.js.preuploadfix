// ============================================================
// library/routes.js
// ------------------------------------------------------------
// Library endpoints.
//   GET    /api/library                       (logged-in: approved docs)
//   GET    /api/library/:id/download          (logged-in: download approved)
//   GET    /api/library/:id/read              (logged-in: read inline)
//   GET    /api/library/admin                 (admin: all docs)
//   POST   /api/library/admin/upload          (admin: standard upload)
//   POST   /api/library/admin/archive-headers (admin: get archive.org auth)
//   POST   /api/library/admin/archive-confirm (admin: save archive.org record)
//   PATCH  /api/library/admin/:id/approve
//   POST   /api/library/admin/:id/reprocess
//   DELETE /api/library/admin/:id
// ============================================================

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

// Sources whose files can vanish on Render's ephemeral filesystem.
// When their file is missing, we clean up the DB row so the next
// sync restores it — and give the student a friendly message.
const FETCHED_SOURCES = ['internetarchive', 'openstax', 'googlebooks', 'gutenberg'];

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

// ---- Public (logged-in) ----

router.get('/', requireLogin, async function (req, res, next) {
  try { res.json({ documents: await db.library.listApproved() }); }
  catch (err) { next(err); }
});

// Download a resource
router.get('/:id/download', requireLogin, async function (req, res, next) {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // Students can only download approved docs. Admins can download anything.
    if (!doc.approved && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // If it's an archive.org link, redirect to it
    if (doc.storage_path && doc.storage_path.startsWith('https://archive.org')) {
      return res.redirect(doc.storage_path);
    }

    // File missing on disk?
    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      // Fetched sources live on ephemeral storage — clean up the orphan
      // record and tell the student it will come back on the next sync.
      if (FETCHED_SOURCES.includes(doc.source_type)) {
        db.pool.query('DELETE FROM library_documents WHERE id = $1', [doc.id])
          .catch(function () {});
        return res.status(404).json({
          error: 'This book was removed from the server and will be restored on the next sync.',
          will_restore: true,
        });
      }
      return res.status(404).json({ error: 'File missing on server' });
    }

    // Robust filename handling for local downloads
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

// Read inline (no download prompt)
router.get('/:id/read', requireLogin, async function (req, res, next) {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // Students can only read approved docs. Admins can read anything.
    if (!doc.approved && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // If it's an archive.org link, redirect to it
    if (doc.storage_path && doc.storage_path.startsWith('https://archive.org')) {
      return res.redirect(doc.storage_path);
    }

    // File missing on disk?
    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      if (FETCHED_SOURCES.includes(doc.source_type)) {
        db.pool.query('DELETE FROM library_documents WHERE id = $1', [doc.id])
          .catch(function () {});
        return res.status(404).json({
          error: 'This book was removed from the server and will be restored on the next sync.',
          will_restore: true,
        });
      }
      return res.status(404).json({ error: 'File missing on server' });
    }

    // Otherwise stream from local filesystem
    return reader.streamBook(req, res, next);
  } catch (err) { next(err); }
});

// ---- Admin ----

router.get('/admin', requireAdmin, async function (req, res, next) {
  try { res.json({ documents: await db.library.listAll() }); }
  catch (err) { next(err); }
});

// Standard local upload (small files)
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

// --- INTERNET ARCHIVE DIRECT UPLOAD ROUTES ---

// 1. Generate secure upload URL and headers for the frontend
router.post('/admin/archive-headers', requireAdmin, async function (req, res, next) {
  try {
    const accessKey = process.env.ARCHIVE_ACCESS_KEY;
    const secretKey = process.env.ARCHIVE_SECRET_KEY;

    if (!accessKey || !secretKey) {
      return res.status(500).json({ error: 'Archive keys not configured on server.' });
    }

    const { filename, title } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required.' });

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7);
    const identifier = 'tcsss-' + timestamp + '-' + random;

    const cleanFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uploadUrl = 'https://s3.us.archive.org/' + identifier + '/' + cleanFilename;

    const headers = {
      'Authorization': 'LOW ' + accessKey + ':' + secretKey,
      'x-archive-auto-make-bucket': '1',
      'x-archive-meta-title': title || 'TCSSS Textbook',
      'x-archive-meta-collection': 'opensource',
      'x-archive-meta-mediatype': 'texts',
      'x-archive-meta-subject': 'tcsss; textbook; education',
      'x-archive-meta-description': 'Uploaded via TCSSS AI Learning Platform'
    };

    res.json({
      uploadUrl: uploadUrl,
      identifier: identifier,
      cleanFilename: cleanFilename,
      headers: headers
    });

  } catch (err) {
    next(err);
  }
});

// 2. Confirm the upload finished and save to Database
router.post('/admin/archive-confirm', requireAdmin, async function (req, res, next) {
  try {
    const { title, subject, author, archiveUrl, identifier, fileSize } = req.body;

    if (!title || !archiveUrl || !identifier) {
      return res.status(400).json({ error: 'Missing required book details.' });
    }

    const filename = archiveUrl.split('/').pop() || 'archive-upload';
    const mimeType = filename.endsWith('.pdf') ? 'application/pdf'
                   : filename.endsWith('.epub') ? 'application/epub+zip'
                   : filename.endsWith('.txt') ? 'text/plain'
                   : filename.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                   : 'application/octet-stream';

    const query = `
      INSERT INTO library_documents
      (title, subject, author, storage_path, approved, source_type, external_id, filename, original_name, size_bytes, mime_type, status, processing_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'approved', 'ready')
      RETURNING *
    `;

    const values = [
      title,
      subject || null,
      author || null,
      archiveUrl,
      true,
      'upload',
      identifier,
      filename,
      filename,
      fileSize || 0,
      mimeType
    ];

    const result = await db.pool.query(query, values);

    res.status(201).json({ document: result.rows[0] });

  } catch (err) {
    next(err);
  }
});

// Endpoints for approval and management
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

// Multer error handler (must be at the bottom)
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