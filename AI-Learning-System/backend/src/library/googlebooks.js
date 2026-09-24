// ============================================================
// library/googlebooks.js
// ------------------------------------------------------------
// Fetch public-domain books from Google Books API.
// PDF-only: books without a public PDF download are skipped.
// Every item here is legally public domain (full view = free).
// ============================================================

const fs = require('fs');

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

// Browser-like headers — Google's signed download URLs reject
// requests without these and return HTTP 403.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://books.google.com/',
  'Accept': 'application/pdf,*/*',
};

/**
 * Search Google Books for downloadable PDFs.
 * Returns { ok: true, books: [...] } or { ok: false, code, detail }.
 */
async function search(query, { limit = 25 } = {}) {
  const key = process.env.GOOGLE_BOOKS_KEY || process.env.GOOGLE_BOOKS_API_KEY;

 const params = new URLSearchParams({
  q: query || 'science',
  maxResults: String(Math.min(Math.max(limit, 1), 40)),
  printType: 'books',
});
  if (key) params.set('key', key);

  const url = GOOGLE_BOOKS_API + '?' + params.toString();

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': BROWSER_HEADERS['User-Agent'],
      },
    });
  } catch (err) {
    return { ok: false, code: 'NETWORK_ERROR', detail: err.message };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, code: 'HTTP_' + res.status, detail: txt.slice(0, 200) };
  }

  const data = await res.json().catch(() => ({}));
  const items = Array.isArray(data.items) ? data.items : [];

  const books = [];
  for (const item of items) {
    const info = item.volumeInfo || {};
    const access = item.accessInfo || {};

    // PDF-only: skip books without a public PDF download link
    const pdfUrl = access.pdf && access.pdf.downloadLink;
    if (!pdfUrl) continue;

    books.push({
      external_id: 'googlebooks-' + item.id,
      title: info.title || 'Untitled',
      author: (Array.isArray(info.authors) && info.authors.length)
        ? info.authors.join(', ')
        : 'Unknown',
      cover_url: (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || null,
      external_url: info.infoLink || ('https://books.google.com/books?id=' + item.id),
      pdf_url: pdfUrl,
      page_count: info.pageCount || null,
      published_date: info.publishedDate || null,
      publisher: info.publisher || null,
      description: info.description || null,
    });

    if (books.length >= limit) break;
  }

  return { ok: true, books };
}

/**
 * Download a PDF from a Google Books downloadLink to destPath.
 * Uses browser-like headers because Google's signed URLs reject
 * plain server-side requests with HTTP 403.
 */
async function downloadPdf(url, destPath) {
  // Google sometimes returns http:// — force https:// which the signed redirect expects
  const safeUrl = url.replace(/^http:\/\//i, 'https://');

  const attempt = async () => {
    const res = await fetch(safeUrl, {
      headers: BROWSER_HEADERS,
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
  };

  try {
    return await attempt();
  } catch (err) {
    // 429 = rate limit. Wait 5s and try once more.
    if (err.status === 429) {
      await new Promise(r => setTimeout(r, 5000));
      return await attempt();
    }
    throw err;
  }
}

module.exports = { search, downloadPdf };