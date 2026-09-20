// ============================================================
// library/fetcher.js
// ------------------------------------------------------------
// Background job: for each enabled library_source, search
// Project Gutenberg, download any new EPUBs, and insert them
// as pre-approved library documents.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../db');
const logger = require('../core/logger');
const gutenberg = require('./gutenberg');
const storage = require('./storage');
const processor = require('./processor');

const INTERVAL_MS = 6 * 60 * 60 * 1000;
let timer = null;
let running = false;

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

async function importBook(book, source) {
  // Skip if already imported
  const existing = await db.pool.query(
    'SELECT id FROM library_documents WHERE external_id = $1 LIMIT 1',
    [book.external_id]
  );
  if (existing.rowCount > 0) return { skipped: true };

  const filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') +
                   '-' + slugify(book.title) + '.epub';
  const destPath = path.join(storage.LIBRARY_DIR, filename);

  // Try downloading, up to 2 attempts
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await gutenberg.downloadEpub(book.epub_url, destPath);
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
     VALUES (NULL, $1, $2, $3, $4, $5, 'application/epub+zip',
             $6, $7, 'approved', TRUE, now(),
             'gutenberg', $8, $9)
     RETURNING id`,
    [
      book.title,
      source.subject || null,
      book.author || null,
      filename,
      book.title + '.epub',
      size,
      destPath,
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
      try {
        const search = await gutenberg.search(src.query || 'science', {
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
          // Gentle pacing — respects Gutendex & archive.org
          await sleep(350);
        }

        totalImported += imported;
        totalSkipped += skipped;
        totalFailed += failed;

        await db.pool.query(
          'UPDATE library_sources SET last_synced_at = now(), last_error = NULL WHERE id = $1',
          [src.id]
        );
        logger.info('[fetcher] ' + src.name + ': +' + imported + ' new, ' +
                    skipped + ' existing, ' + failed + ' failed');
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
  }, 15 * 1000); // 15s after boot
  timer = setInterval(function () {
    runOnce().catch(function (err) { logger.error('[fetcher] run failed: ' + err.message); });
  }, INTERVAL_MS);
  logger.info('[fetcher] scheduled (every 6h)');
}

module.exports = { start: start, runOnce: runOnce, isRunning: function () { return running; } };
