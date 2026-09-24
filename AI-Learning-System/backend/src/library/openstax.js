// ============================================================
// library/openstax.js
// ------------------------------------------------------------
// Fetch modern, openly-licensed textbooks from OpenStax.
// All content is CC-BY licensed — free to read and redistribute.
// PDF-only source: every live book has a downloadable PDF.
//
// OpenStax's list endpoint returns only meta info, so we do a
// two-step fetch: (1) list all book IDs, (2) fetch each detail.
// Results are cached in memory for 5 minutes.
// ============================================================

const fs = require('fs');

const CMS_API = 'https://openstax.org/apps/cms/api/v2/pages/';
const USER_AGENT = 'TCSSS-Library/1.0 (+https://tcsss-ai-learning-platform.onrender.com)';

const CACHE_TTL_MS = 5 * 60 * 1000;
const DETAIL_BATCH = 16;     // parallel detail fetches per batch
const BATCH_DELAY_MS = 150;  // pause between batches

let cache = null;
let cacheTime = 0;

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchAllBooks() {
  if (cache && (Date.now() - cacheTime) < CACHE_TTL_MS) return cache;

  // ---------- Step 1: list all book IDs ----------
  const listIds = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const url = CMS_API + '?type=books.Book&limit=' + pageSize + '&offset=' + offset;
    let res;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
    } catch (_) {
      throw new Error('NETWORK_ERROR');
    }
    if (!res.ok) throw new Error('HTTP_' + res.status);

    const data = await res.json().catch(() => ({}));
    const items = Array.isArray(data.items) ? data.items : [];
    const total = (data.meta && data.meta.total_count) || 0;

    for (const it of items) if (it.id) listIds.push(it.id);

    if (items.length === 0 || listIds.length >= total) break;
    offset += pageSize;
  }

  // ---------- Step 2: fetch detail for each book ----------
  const enriched = [];
  for (let i = 0; i < listIds.length; i += DETAIL_BATCH) {
    const slice = listIds.slice(i, i + DETAIL_BATCH);
    const details = await Promise.all(slice.map(id =>
      fetch(CMS_API + id + '/', {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
    ));
    for (const d of details) if (d && d.id) enriched.push(d);
    if (i + DETAIL_BATCH < listIds.length) await sleep(BATCH_DELAY_MS);
  }

  cache = enriched;
  cacheTime = Date.now();
  return enriched;
}

/**
 * Score a book against the query terms.
 * Title matches score 10x — descriptions score 1x.
 * Returns 0 if no match.
 */
function scoreBook(item, terms) {
  if (!terms.length) return 1;

  const title = (item.title || '').toLowerCase();
  const subjectNames = (item.book_subjects || [])
    .map(s => s.subject_name || '')
    .join(' ').toLowerCase();
  const descText = stripHtml(item.description || '').toLowerCase();

  let score = 0;
  for (const t of terms) {
    if (title.includes(t))         score += 10;
    if (subjectNames.includes(t))  score += 3;
    if (descText.includes(t))      score += 1;
  }
  return score;
}

/**
 * Search OpenStax for books matching a query.
 */
async function search(query, { limit = 25 } = {}) {
  let items;
  try {
    items = await fetchAllBooks();
  } catch (err) {
    return { ok: false, code: err.message };
  }

  const q = (query || '').toLowerCase().trim();
  const terms = q.split(/\s+/).filter(Boolean);

  const scored = [];
  for (const item of items) {
    // Only published books
    if (item.book_state && item.book_state !== 'live') continue;

    // PDF link — prefer pdf_url, fall back to hi-res
    const pdfUrl = item.pdf_url || item.high_resolution_pdf_url || item.low_resolution_pdf_url;
    if (!pdfUrl) continue;

    const score = scoreBook(item, terms);
    if (score === 0) continue;

    const slug = (item.meta && item.meta.slug) || String(item.id);
    const htmlUrl = (item.meta && item.meta.html_url) ||
                    ('https://openstax.org/details/books/' + slug);

    const authors = Array.isArray(item.authors)
      ? item.authors.map(a => (a && a.value && a.value.name) || '').filter(Boolean)
      : [];

    scored.push({
      _score: score,
      external_id: 'openstax-' + slug,
      title: item.title || 'Untitled',
      author: authors.length ? authors.join(', ') : 'OpenStax',
      cover_url: item.cover_url || null,
      external_url: htmlUrl,
      pdf_url: pdfUrl,
    });
  }

  // Highest score first, so title matches win
  scored.sort((a, b) => b._score - a._score);
  const books = scored.slice(0, limit).map(b => {
    delete b._score;
    return b;
  });

  return { ok: true, books };
}

/**
 * Download a PDF from OpenStax's CDN to destPath.
 */
async function downloadPdf(url, destPath) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/pdf,*/*',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('Download HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
  return true;
}

module.exports = { search, downloadPdf };