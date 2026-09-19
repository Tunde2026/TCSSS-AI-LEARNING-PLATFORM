// Extracts plain text from an uploaded file.
// Supports PDF, DOCX, and TXT.

const fs   = require('fs');
const path = require('path');

async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (mimeType === 'text/plain' || ext === '.txt') {
    return fs.promises.readFile(filePath, 'utf8');
  }

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    // pdf-parse has a quirk where it reads a test file at import time.
    // Requiring the lib file directly avoids that.
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const buffer = await fs.promises.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || ext === '.docx'
  ) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  if (mimeType === 'application/epub+zip' || ext === '.epub') {
    // EPUB support is minimal for now. Treat as text if it works, else error.
    throw new Error('EPUB extraction is not yet supported.');
  }

  throw new Error('Unsupported file type for text extraction.');
}

// Normalize text: collapse whitespace, remove control chars, keep paragraph breaks.
function normalizeText(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')          // trailing spaces
    .replace(/\n{3,}/g, '\n\n')          // max 2 consecutive newlines
    .replace(/[ \t]{2,}/g, ' ')          // collapse runs of spaces
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')  // control chars
    .trim();
}

module.exports = { extractText, normalizeText };