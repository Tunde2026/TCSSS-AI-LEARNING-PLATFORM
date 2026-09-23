// ============================================================
// library/fetcher.js
// ------------------------------------------------------------
// Background job: for each enabled library_source, search the
// appropriate adapter, download any new books, and insert them
// as pre-approved library documents.
//
// Adapters:
//   - gutenberg   → EPUB files (existing behavior, unchanged)
//   - googlebooks → PDF files only (read-only for students)
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../db');
const logger = require('../core/logger');
const gutenberg = require('./gutenberg');
const googlebooks = require('./googlebooks');
const storage = require('./storage');
const processor = require('./processor');

const INTERVAL_MS = 6 * 60 * 60 * 1000;
let timer = null;
let running = false;

const ADAPTERS = {
  gutenberg: gutenberg,
  googlebooks: googlebooks,
};

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'book';
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
  return true;
}

/**
 * Normalize adapter-specific book shape into a common form.
 * Returns null if the book cannot be downloaded for this source.
 */
function normalizeBook(book, sourceType) {
  if (sourceType === 'gutenberg') {
    if (!book.epub_url) return null;
    return {
      external_id: book.external_id,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      external_url: book.external_url,
      download_url: book.epub_url,
      ext: '.epub',
      mime: 'application/epub+zip',
    };
  }
  if (sourceType === 'googlebooks') {
    if (!book.pdf_url) return null;
    return {
      external_id: book.external_id,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      external_url: book.external_url,
      download_url: book.pdf_url,
      ext: '.pdf',
      mime: 'application/pdf',
    };
  }
  return null;
}

async function importBook(rawBook, source) {
  const sourceType = source.source_type || 'gutenberg';
  const book = normalizeBook(rawBook, sourceType);
  if (!book) return { skipped: true, reason: 'unsupported_format' };

  // Skip if already imported
  const existing = await db.pool.query(
    'SELECT id FROM library_documents WHERE external_id = $1 LIMIT 1',
    [book.external_id]
  );
  if (existing.rowCount > 0) return { skipped: true };

  const filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') +
                   '-' + slugify(book.title) + book.ext;
  const destPath = path.join(storage.LIBRARY_DIR, filename);

  // Try downloading, up to 2 attempts
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await downloadFile(book.download_url, destPath);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      await sleep(500);
    }
  }
  if (lastErr) {
    logger.warn('[fetcher] download failed for "' + book.title + '": ' + lastErr.message);
    return { failed: true };
  }

  let size = 0;
  try { size = fs.statSync(destPath).size; } catch (_) {}

  const result = await db.pool.query(
    `INSERT INTO library_documents
       (uploaded_by, title, subject, author, filename, original_name, mime_type,
        size_bytes, storage_path, status, approved, approved_at,
        source_type, external_id, external_url)
     VALUES (NULL, $1, $2, $3, $4, $5, $6,
             $7, $8, 'approved', TRUE, now(),
             $9, $10, $11)
     RETURNING id`,
    [
      book.title,
      source.subject || null,
      book.author || null,
      filename,
      book.title + book.ext,
      book.mime,
      size,
      destPath,
      sourceType,
      book.external_id,
      book.external_url,
    ]
  );

  const docId = result.rows[0].id;
  processor.processInBackground(docId);
  return { imported: true, id: docId };
}

async function runOnce() {
  if (running) {
    logger.info('[fetcher] already running — skipping duplicate call');
    return 0;
  }
  running = true;
  logger.info('[fetcher] sync started');

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    const sources = await db.pool.query(
      'SELECT * FROM library_sources WHERE enabled = TRUE ORDER BY id'
    );

    for (const src of sources.rows) {
      const adapter = ADAPTERS[src.source_type];
      if (!adapter) {
        logger.warn('[fetcher] unknown source_type "' + src.source_type + '" for source ' + src.name);
        await db.pool.query(
          'UPDATE library_sources SET last_error = $1 WHERE id = $2',
          ['UNKNOWN_SOURCE_TYPE', src.id]
        );
        continue;
      }

      try {
        const search = await adapter.search(src.query || 'science', {
          limit: src.max_items || 40,
        });
        if (!search.ok) {
          await db.pool.query(
            'UPDATE library_sources SET last_error = $1 WHERE id = $2',
            [search.code, src.id]
          );
          logger.warn('[fetcher] ' + src.name + ': search failed (' + search.code + ')');
          continue;
        }

        let imported = 0, skipped = 0, failed = 0;
        for (const book of search.books) {
          try {
            const r = await importBook(book, src);
            if (r.imported) imported++;
            else if (r.skipped) skipped++;
            else if (r.failed) failed++;
          } catch (err) {
            failed++;
            logger.warn('[fetcher] book insert failed: ' + err.message);
          }
          await sleep(350);  // gentle pacing
        }

        totalImported += imported;
        totalSkipped += skipped;
        totalFailed += failed;

        await db.pool.query(
          'UPDATE library_sources SET last_synced_at = now(), last_error = NULL WHERE id = $1',
          [src.id]
        );
        logger.info('[fetcher] ' + src.name + ' (' + src.source_type + '): +' +
                    imported + ' new, ' + skipped + ' existing, ' + failed + ' failed');
      } catch (err) {
        await db.pool.query(
          'UPDATE library_sources SET last_error = $1 WHERE id = $2',
          [err.message.slice(0, 200), src.id]
        );
        logger.warn('[fetcher] source "' + src.name + '" threw: ' + err.message);
      }
    }
  } finally {
    running = false;
  }

  logger.info('[fetcher] sync complete — ' + totalImported + ' new, ' +
              totalSkipped + ' existing, ' + totalFailed + ' failed');
  return totalImported;
}

function start() {
  if (timer) return;
  setTimeout(function () {
    runOnce().catch(function (err) { logger.error('[fetcher] run failed: ' + err.message); });
  }, 15 * 1000);
  timer = setInterval(function () {
    runOnce().catch(function (err) { logger.error('[fetcher] run failed: ' + err.message); });
  }, INTERVAL_MS);
  logger.info('[fetcher] scheduled (every 6h)');
}

module.exports = { start: start, runOnce: runOnce, isRunning: function () { return running; } };