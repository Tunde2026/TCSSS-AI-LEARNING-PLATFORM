// ============================================================
// library/retrieval.js
// ------------------------------------------------------------
// Semantic search over approved chunks in the library.
// ============================================================

const db        = require('../db');
const logger    = require('../core/logger');
const embedding = require('./embedding');

async function retrieveContext(query, { limit = 4, minSimilarity = 0.55 } = {}) {
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return { chunks: [], contextText: '' };
  }

  try {
    const n = await db.documentChunks.countApproved();
    if (n === 0) return { chunks: [], contextText: '' };
  } catch (_) {
    return { chunks: [], contextText: '' };
  }

  let queryVec;
  try {
    queryVec = await embedding.embedOne(query.trim());
  } catch (err) {
    logger.warn('[retrieval] embedding failed:', err.message);
    return { chunks: [], contextText: '' };
  }

  let rows;
  try {
    rows = await db.documentChunks.searchByVector(queryVec, limit, minSimilarity);
  } catch (err) {
    logger.warn('[retrieval] search failed:', err.message);
    return { chunks: [], contextText: '' };
  }

  if (!rows.length) return { chunks: [], contextText: '' };

  const blocks = rows.map(function (r, i) {
    var header = '[' + (i + 1) + '] From "' + r.document_title + '"' +
      (r.document_subject ? ' — ' + r.document_subject : '');
    return header + '\n' + r.content;
  });

  var contextText =
    'The following passages are from your school\'s approved library. ' +
    'Use them to inform your answer when relevant. Do not quote them verbatim ' +
    'unless it helps the student.\n\n' +
    blocks.join('\n\n---\n\n');

  return { chunks: rows, contextText: contextText };
}

module.exports = { retrieveContext };