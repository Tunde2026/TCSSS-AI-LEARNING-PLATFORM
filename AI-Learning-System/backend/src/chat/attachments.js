// ============================================================
// chat/attachments.js
// ------------------------------------------------------------
// Upload, extract, and retrieve text from chat attachments.
// ============================================================

const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const db       = require('../db');
const logger   = require('../core/logger');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const UPLOAD_DIR   = path.join(PROJECT_ROOT, 'uploads', 'chat');

const MAX_SIZE = 20 * 1024 * 1024;   // 20 MB

const ALLOWED_DOC_TYPES = {
  'application/pdf':  ['.pdf'],
  'application/epub+zip': ['.epub'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

function ensureDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function validateFile(file) {
  if (!file) return { ok: false, reason: 'No file' };
  const allowed = ALLOWED_DOC_TYPES[file.mimetype];
  if (!allowed) return { ok: false, reason: 'Unsupported file type. Use PDF, DOCX, TXT, MD, or EPUB.' };
  if (file.size > MAX_SIZE) return { ok: false, reason: 'File is too large. Maximum is 20 MB.' };
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext && !allowed.includes(ext)) {
    return { ok: false, reason: 'File extension does not match the file type.' };
  }
  return { ok: true };
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'file';
}

function generateFilename(originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  const slug = slugify(path.basename(originalName || '', ext));
  return ts + '-' + rand + '-' + slug + ext;
}

async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (mimeType === 'text/plain' || mimeType === 'text/markdown'
      || ext === '.txt' || ext === '.md') {
    return fs.promises.readFile(filePath, 'utf8');
  }

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const buffer = await fs.promises.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  throw new Error('Extraction not supported for this file type.');
}

function normalizeText(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

// Called from the route AFTER the multer write.
// Extraction runs in the background so the upload responds fast.
function processInBackground(attachmentId, filePath, mimeType) {
  setImmediate(async () => {
    try {
      const raw = await extractText(filePath, mimeType);
      const text = normalizeText(raw).slice(0, 100000);   // cap at ~100k chars
      await db.chatAttachments.setExtraction(attachmentId, 'ready', text, null);
      logger.info('[chat] extracted ' + text.length + ' chars from attachment ' + attachmentId);
    } catch (err) {
      logger.warn('[chat] extraction failed for ' + attachmentId + ': ' + err.message);
      await db.chatAttachments.setExtraction(attachmentId, 'failed', null, err.message);
    }
  });
}

async function saveUpload({ userId, file }) {
  const check = validateFile(file);
  if (!check.ok) return { ok: false, code: 'INVALID', detail: check.reason };

  ensureDirs();
  const filename = generateFilename(file.originalname);
  const fullPath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(fullPath, file.buffer);

  const att = await db.chatAttachments.create({
    userId: userId,
    filename: filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath: fullPath,
  });

  processInBackground(att.id, fullPath, file.mimetype);
  return { ok: true, attachment: att };
}

// Build context block to inject into the AI prompt.
async function buildContextFor(ids, userId) {
  if (!ids || !ids.length) return '';
  const rows = await db.chatAttachments.listByIds(ids, userId);
  if (!rows.length) return '';

  const parts = rows.map(function (r) {
    if (r.extraction_status === 'ready' && r.extracted_text) {
      return 'Contents of "' + r.original_name + '":\n\n' + r.extracted_text;
    }
    if (r.extraction_status === 'failed') {
      return 'The user attached "' + r.original_name + '", but the text could not be extracted.';
    }
    return 'The user attached "' + r.original_name + '". Text extraction is still in progress.';
  });

  return 'The student has attached the following document(s). Read them carefully.\n\n=====\n\n' +
    parts.join('\n\n=====\n\n');
}

module.exports = {
  saveUpload,
  buildContextFor,
  validateFile,
  UPLOAD_DIR,
};