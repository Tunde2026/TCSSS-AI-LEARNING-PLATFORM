// ============================================================
// library/internetarchive.js
// ------------------------------------------------------------
// Fetch public-domain books from Internet Archive (archive.org).
// PDF-only: books without a public PDF file are skipped.
// Every item here is legally public domain or openly licensed.
// ============================================================

const fs = require('fs');

const IA_SEARCH   = 'https://archive.org/advancedsearch.php';
const IA_METADATA = 'https://archive.org/metadata/';
const IA_DOWNLOAD = 'https://archive.org/download/';

const USER_AGENT = 'TCSSS-Library/1.0 (+https://tcsss-ai-learning-platform.onrender.com)';

/**
 * Search Internet Archive for public-domain books with downloadable PDFs.
 * Returns { ok: true, books: [...] } or { ok: false, code, detail }.
 */
async function search(query, { limit = 25 } = {}) {
  const rows = Math.min(Math.max(limit * 3, 30), 100);

  // Exclude lending-library and print-disabled items — we only want free-to-download.
  const q = encodeURIComponent(
    `${query || 'science'} ` +
    `AND mediatype:texts ` +
    `AND format:PDF ` +
    `AND -collection:inlibrary ` +
    `AND -collection:printdisabled ` +
    `AND -collection:opensource_image`
  );
  const fields = ['identifier', 'title', 'creator', 'year', 'collection']
    .map(f => 'fl[]=' + f)
    .join('&');

  const url = `${IA_SEARCH}?q=${q}&${fields}&rows=${rows}&page=1&output=json&sort[]=downloads+desc`;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
  } catch (err) {
    return { ok: false, code: 'NETWORK_ERROR', detail: err.message };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, code: 'HTTP_' + res.status, detail: txt.slice(0, 200) };
  }

  const data = await res.json().catch(() => ({}));
  const docs = (data.response && data.response.docs) || [];

  const BATCH = 5;
  const books = [];
  for (let i = 0; i < docs.length && books.length < limit; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(enrichOne));
    for (const r of results) {
      if (r) books.push(r);
      if (books.length >= limit) break;
    }
  }

  return { ok: true, books: books.slice(0, limit) };
}

/**
 * Fetch metadata for one IA identifier and find a downloadable PDF.
 * Returns null if the item is restricted, low-quality, or has no PDF.
 */
async function enrichOne(doc) {
  const identifier = doc && doc.identifier;
  if (!identifier) return null;

  // Skip known-low-quality mirrors — they often 500 on download.
  const lowerTitle = (doc.title || '').toLowerCase();
  if (lowerTitle.includes('(pdfy mirror)') ||
      lowerTitle.includes('(archive.org mirror)') ||
      lowerTitle.includes('(user upload)')) {
    return null;
  }

  let res;
  try {
    res = await fetch(IA_METADATA + encodeURIComponent(identifier), {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
  } catch (_) {
    return null;
  }
  if (!res.ok) return null;

  const meta = await res.json().catch(() => ({}));
  if (!meta || !meta.metadata) return null;

  // Skip lending-library items — those are borrow-only.
  if (String(meta.metadata['access-restricted-item']).toLowerCase() === 'true') {
    return null;
  }

  const collections = Array.isArray(meta.metadata.collection)
    ? meta.metadata.collection
    : [meta.metadata.collection].filter(Boolean);
  if (collections.includes('inlibrary') || collections.includes('printdisabled')) {
    return null;
  }

  const files = Array.isArray(meta.files) ? meta.files : [];
  const pdfs = files.filter(f => f.name && f.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) return null;

  // Prefer OCR'd "Text PDF" so it's searchable, else take the first PDF.
  const chosen = pdfs.find(f => f.format === 'Text PDF') || pdfs[0];

  const creator = doc.creator;
  const authorStr = Array.isArray(creator)
    ? creator.join(', ')
    : (creator || 'Unknown');

  return {
    external_id: 'ia-' + identifier,
    title: doc.title || 'Untitled',
    author: authorStr,
    cover_url: 'https://archive.org/services/img/' + identifier,
    external_url: 'https://archive.org/details/' + identifier,
    pdf_url: IA_DOWNLOAD + encodeURIComponent(identifier) + '/' + encodeURIComponent(chosen.name),
    published_date: doc.year ? String(doc.year) : null,
  };
}

/**
 * Download a PDF from archive.org to destPath.
 * Retries up to 3 times on 5xx / network errors with exponential backoff.
 */
async function downloadPdf(url, destPath) {
  const MAX_ATTEMPTS = 3;
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/pdf,*/*',
        },
        redirect: 'follow',
      });

      if (!res.ok) {
        const err = new Error('Download HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }

      const buf = await res.arrayBuffer();
      fs.writeFileSync(destPath, Buffer.from(buf));
      return true;
    } catch (err) {
      lastErr = err;
      const transient = !err.status || err.status >= 500 || err.status === 429;
      if (!transient || attempt === MAX_ATTEMPTS) break;
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  throw lastErr || new Error('Download failed');
}

module.exports = { search, downloadPdf };