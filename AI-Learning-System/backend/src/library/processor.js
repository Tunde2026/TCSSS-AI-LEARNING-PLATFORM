// Orchestrates: extract text → chunk → embed → store.

const db       = require('../db');
const logger   = require('../core/logger');
const extract  = require('./extract');
const chunking = require('./chunking');
const embedding = require('./embedding');

const MAX_EXTRACT_CHARS = 400_000;  // safety cap (~100 pages of prose)

async function processDocument(documentId) {
  const doc = await db.library.findById(documentId);
  if (!doc) {
    logger.warn(`[processor] document ${documentId} not found`);
    return { ok: false, code: 'NOT_FOUND' };
  }

  // Mark as processing
  await setStatus(documentId, 'processing', null, null);

  try {
    // 1. Extract
    let raw;
    try {
      raw = await extract.extractText(doc.storage_path, doc.mime_type);
    } catch (err) {
      await setStatus(documentId, 'failed', err.message, null);
      logger.error(`[processor] extract failed for ${doc.id}:`, err.message);
      return { ok: false, code: 'EXTRACT_FAILED' };
    }

    const text = extract.normalizeText(raw).slice(0, MAX_EXTRACT_CHARS);
    if (!text || text.length < 100) {
      await setStatus(documentId, 'failed', 'Document contains no readable text.', null);
      return { ok: false, code: 'NO_TEXT' };
    }

    // 2. Chunk
    const chunks = chunking.chunkText(text);
    if (!chunks.length) {
      await setStatus(documentId, 'failed', 'Could not split document into chunks.', null);
      return { ok: false, code: 'NO_CHUNKS' };
    }

    logger.info(`[processor] ${doc.id}: ${chunks.length} chunks, embedding…`);

    // 3. Embed (in batches to avoid giant requests)
    const BATCH = 16;
    const embedded = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vectors = await embedding.embedMany(slice);
      for (let j = 0; j < slice.length; j++) {
        embedded.push({ content: slice[j], embedding: vectors[j] });
      }
    }

    // 4. Store (approved = false; will flip when admin approves)
    await db.documentChunks.replaceForDocument(documentId, embedded.map(c => ({
      content: c.content,
      embedding: c.embedding,
      approved: doc.approved || false,
    })));

    await setStatus(documentId, 'ready', null, embedded.length);
    logger.info(`[processor] ${doc.id}: done (${embedded.length} chunks)`);
    return { ok: true, chunkCount: embedded.length };

  } catch (err) {
    await setStatus(documentId, 'failed', err.message, null);
    logger.error(`[processor] unexpected error for ${doc.id}:`, err.message);
    return { ok: false, code: 'UNEXPECTED' };
  }
}

async function setStatus(documentId, status, error, chunkCount) {
  try {
    await db.pool.query(
      `UPDATE library_documents
          SET processing_status = $1,
              processing_error  = $2,
              processed_at      = CASE WHEN $1 = 'ready' THEN now() ELSE processed_at END,
              chunk_count       = COALESCE($3, chunk_count)
        WHERE id = $4`,
      [status, error, chunkCount, documentId]
    );
  } catch (e) {
    logger.error('[processor] setStatus failed:', e.message);
  }
}

// Fire-and-forget: called from routes, doesn't block the HTTP response.
function processInBackground(documentId) {
  setImmediate(() => {
    processDocument(documentId).catch(err => {
      logger.error('[processor] background failure:', err.message);
    });
  });
}

module.exports = { processDocument, processInBackground };