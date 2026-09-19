const db       = require('../db');
const logger   = require('../core/logger');
const storage  = require('./storage');
const processor = require('./processor');

async function saveUpload({ adminId, file, meta }) {
  if (!file) return { ok: false, code: 'NO_FILE' };

  const check = storage.validateFile(file);
  if (!check.ok) {
    storage.removeFile(file.path);
    return { ok: false, code: 'BAD_TYPE', detail: check.reason };
  }

  const title = (meta.title || file.originalname || '').trim();
  if (!title) {
    storage.removeFile(file.path);
    return { ok: false, code: 'NO_TITLE' };
  }

  const doc = await db.library.create({
    uploadedBy:   adminId,
    title,
    subject:      meta.subject || null,
    level:        meta.level || null,
    author:       meta.author || null,
    filename:     file.filename,
    originalName: file.originalname,
    mimeType:     file.mimetype,
    sizeBytes:    file.size,
    storagePath:  file.path,
  });

  logger.info(`[library] uploaded: ${doc.title} → ${doc.filename}`);

  // Kick off extraction / chunking / embedding in the background.
  processor.processInBackground(doc.id);

  return { ok: true, document: doc };
}

async function deleteDocument(id) {
  const doc = await db.library.findById(id);
  if (!doc) return { ok: false, code: 'NOT_FOUND' };

  storage.removeFile(doc.storage_path);

  const removed = await db.library.remove(id);
  return removed ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
}

// Called when admin approves / unapproves
async function setApproval(id, approved, adminId) {
  const doc = await db.library.setApproved(id, approved, adminId);
  if (!doc) return { ok: false, code: 'NOT_FOUND' };

  // Flip chunk approval to match
  try {
    await db.documentChunks.setApprovedByDocument(id, approved);
  } catch (err) {
    logger.warn(`[library] chunk approval sync failed for ${id}:`, err.message);
  }

  return { ok: true, document: doc };
}

module.exports = { saveUpload, deleteDocument, setApproval };