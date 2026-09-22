// ============================================================
// library/storage.js
// ------------------------------------------------------------
// Handles upload folders and safe file naming.
//
// Folders (at project root):
//   uploads/library/     - documents (PDF, DOCX, EPUB, TXT, MD)
//   uploads/branding/    - logo and brand assets
//
// Upload size is capped at 100 MB to match Render's free tier
// request body limit. To go higher, upgrade Render or move to
// S3-compatible storage.
// ============================================================

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const UPLOAD_ROOT  = path.join(PROJECT_ROOT, 'uploads');
const LIBRARY_DIR  = path.join(UPLOAD_ROOT, 'library');
const BRANDING_DIR = path.join(UPLOAD_ROOT, 'branding');

const ALLOWED_DOC_TYPES = {
  'application/pdf':  ['.pdf'],
  'application/epub+zip': ['.epub'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

const ALLOWED_IMAGE_TYPES = {
  'image/png':  ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/svg+xml': ['.svg'],
  'image/webp': ['.webp'],
};

// Render free tier caps request bodies at 100 MB.
// Anything larger and the request never reaches the app.
const MAX_SIZE_BYTES = 100 * 1024 * 1024;   // 100 MB
const MAX_LOGO_BYTES = 2 * 1024 * 1024;     // 2 MB

function ensureUploadDirs() {
  fs.mkdirSync(LIBRARY_DIR,  { recursive: true });
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

function validateDocFile(file) {
  if (!file) return { ok: false, reason: 'No file' };
  const allowed = ALLOWED_DOC_TYPES[file.mimetype];
  if (!allowed) return { ok: false, reason: 'Unsupported file type. Use PDF, DOCX, EPUB, TXT, or MD.' };
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, reason: 'File is too large. Maximum is 100 MB.' };
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext && !allowed.includes(ext)) {
    return { ok: false, reason: 'File extension "' + ext + '" does not match the file type.' };
  }
  return { ok: true };
}

function validateLogo(file) {
  if (!file) return { ok: false, reason: 'No file' };
  const allowed = ALLOWED_IMAGE_TYPES[file.mimetype];
  if (!allowed) return { ok: false, reason: 'Logo must be PNG, JPG, SVG, or WEBP.' };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, reason: 'Logo must be under 2 MB.' };
  return { ok: true };
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
}

function generateFilename(originalName, title) {
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const slug = slugify(title || path.basename(originalName, ext));
  return timestamp + '-' + random + '-' + slug + ext;
}

function libraryPathFor(filename) {
  return path.join(LIBRARY_DIR, filename);
}

function removeFile(storagePath) {
  try {
    if (storagePath && fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
      return true;
    }
  } catch (_) {}
  return false;
}

function saveManualEntry(input) {
  ensureUploadDirs();
  const filename = generateFilename('manual.txt', input.title);
  const fullPath = path.join(LIBRARY_DIR, filename);
  fs.writeFileSync(fullPath, input.text, 'utf8');
  return { filename: filename, fullPath: fullPath, sizeBytes: Buffer.byteLength(input.text, 'utf8') };
}

function saveLogo(input) {
  ensureUploadDirs();
  const file = input.file;
  const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
  const filename = 'logo' + ext;
  const fullPath = path.join(BRANDING_DIR, filename);

  try {
    const existing = fs.readdirSync(BRANDING_DIR);
    for (const f of existing) {
      if (f.startsWith('logo.')) {
        try { fs.unlinkSync(path.join(BRANDING_DIR, f)); } catch (_) {}
      }
    }
  } catch (_) {}

  fs.writeFileSync(fullPath, file.buffer);
  return { filename: filename, url: '/uploads/branding/' + filename };
}

module.exports = {
  PROJECT_ROOT: PROJECT_ROOT,
  UPLOAD_ROOT: UPLOAD_ROOT,
  LIBRARY_DIR: LIBRARY_DIR,
  BRANDING_DIR: BRANDING_DIR,
  MAX_SIZE_BYTES: MAX_SIZE_BYTES,
  MAX_LOGO_BYTES: MAX_LOGO_BYTES,
  ALLOWED_DOC_TYPES: ALLOWED_DOC_TYPES,
  ALLOWED_IMAGE_TYPES: ALLOWED_IMAGE_TYPES,
  ensureUploadDirs: ensureUploadDirs,
  validateDocFile: validateDocFile,
  validateLogo: validateLogo,
  generateFilename: generateFilename,
  libraryPathFor: libraryPathFor,
  removeFile: removeFile,
  saveManualEntry: saveManualEntry,
  saveLogo: saveLogo,
  slugify: slugify,
};
function ensureUploadDirs() {
  fs.mkdirSync(LIBRARY_DIR,  { recursive: true });
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

function validateDocFile(file) {
  if (!file) return { ok: false, reason: 'No file' };
  const allowed = ALLOWED_DOC_TYPES[file.mimetype];
  if (!allowed) return { ok: false, reason: 'Unsupported file type. Use PDF, DOCX, EPUB, or TXT.' };
  if (file.size > MAX_SIZE_BYTES) return { ok: false, reason: 'File is too large. Maximum is 50 MB.' };
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext && !allowed.includes(ext)) {
    return { ok: false, reason: `File extension "${ext}" does not match the file type.` };
  }
  return { ok: true };
}

function validateLogo(file) {
  if (!file) return { ok: false, reason: 'No file' };
  const allowed = ALLOWED_IMAGE_TYPES[file.mimetype];
  if (!allowed) return { ok: false, reason: 'Logo must be PNG, JPG, SVG, or WEBP.' };
  if (file.size > MAX_LOGO_BYTES) return { ok: false, reason: 'Logo must be under 2 MB.' };
  return { ok: true };
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
}

function generateFilename(originalName, title) {
  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const slug = slugify(title || path.basename(originalName, ext));
  return `${timestamp}-${random}-${slug}${ext}`;
}

function libraryPathFor(filename) {
  return path.join(LIBRARY_DIR, filename);
}

function removeFile(storagePath) {
  try {
    if (storagePath && fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
      return true;
    }
  } catch (_) {}
  return false;
}

// Save a manual knowledge entry (text only, no upload).
function saveManualEntry({ title, text }) {
  ensureUploadDirs();
  const filename = generateFilename('manual.txt', title);
  const fullPath = path.join(LIBRARY_DIR, filename);
  fs.writeFileSync(fullPath, text, 'utf8');
  return { filename, fullPath, sizeBytes: Buffer.byteLength(text, 'utf8') };
}

// Save logo. Overwrites any existing logo.
function saveLogo({ file }) {
  ensureUploadDirs();
  const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
  const filename = 'logo' + ext;
  const fullPath = path.join(BRANDING_DIR, filename);

  // Delete any old logo with a different extension.
  try {
    const existing = fs.readdirSync(BRANDING_DIR);
    for (const f of existing) {
      if (f.startsWith('logo.')) {
        try { fs.unlinkSync(path.join(BRANDING_DIR, f)); } catch (_) {}
      }
    }
  } catch (_) {}

  fs.writeFileSync(fullPath, file.buffer);
  return { filename, url: '/uploads/branding/' + filename };
}

module.exports = {
  PROJECT_ROOT, UPLOAD_ROOT, LIBRARY_DIR, BRANDING_DIR,
  MAX_SIZE_BYTES, MAX_LOGO_BYTES,
  ALLOWED_DOC_TYPES, ALLOWED_IMAGE_TYPES,
  ensureUploadDirs,
  validateDocFile,
  validateLogo,
  generateFilename,
  libraryPathFor,
  removeFile,
  saveManualEntry,
  saveLogo,
  slugify,
};
