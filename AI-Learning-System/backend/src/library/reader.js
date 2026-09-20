// ============================================================
// library/reader.js
// ------------------------------------------------------------
// Stream a book inline for in-browser reading.
// Differs from /download by setting Content-Disposition: inline.
// ============================================================

const fs   = require('fs');
const path = require('path');
const db   = require('../db');

async function streamBook(req, res, next) {
  try {
    const doc = await db.library.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (!doc.approved && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      return res.status(404).json({ error: 'File missing on server' });
    }

    const stat = fs.statSync(doc.storage_path);
    const mime = doc.mime_type || 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'inline; filename="' +
      encodeURIComponent(doc.original_name || doc.filename) + '"');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = fs.createReadStream(doc.storage_path);
    stream.on('error', function (err) { next(err); });
    stream.pipe(res);
  } catch (err) { next(err); }
}

module.exports = { streamBook: streamBook };
