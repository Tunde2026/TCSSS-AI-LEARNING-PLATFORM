// Generates embeddings via Ollama's /api/embed endpoint.
// Model is configured in .env as OLLAMA_EMBED_MODEL.
//
// nomic-embed-text produces 768-dim vectors.
// If you change models, update the vector(768) column definition
// in a new migration.

const config = require('../core/config');
const logger = require('../core/logger');

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const EMBED_DIM   = 768;

function embedBaseUrl() {
  // OLLAMA_URL is like http://localhost:11434/v1
  // We need the native API at http://localhost:11434/api
  const base = (config.ollama && config.ollama.url) || 'http://localhost:11434/v1';
  return base.replace(/\/v1\/?$/, '') + '/api/embed';
}

// Embed a single string. Returns number[].
async function embedOne(text) {
  const out = await embedMany([text]);
  return out[0];
}

// Embed an array of strings. Returns number[][].
async function embedMany(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const url = embedBaseUrl();
  const body = {
    model: EMBED_MODEL,
    input: texts,
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error('[embedding] Ollama unreachable:', err.message);
    throw new Error('EMBEDDING_UNAVAILABLE');
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    logger.error(`[embedding] Ollama returned ${res.status}:`, txt.slice(0, 200));
    throw new Error('EMBEDDING_FAILED');
  }

  const data = await res.json();
  const embeddings = data.embeddings || [];

  if (embeddings.length !== texts.length) {
    throw new Error('EMBEDDING_COUNT_MISMATCH');
  }

  // Sanity check dimensions
  if (embeddings[0] && embeddings[0].length !== EMBED_DIM) {
    logger.warn(
      `[embedding] Model returned ${embeddings[0].length} dims, expected ${EMBED_DIM}`
    );
  }

  return embeddings;
}

// Convert number[] → pgvector literal: "[0.1,0.2,0.3]"
function toVectorLiteral(vec) {
  return '[' + vec.map(n => Number(n).toFixed(6)).join(',') + ']';
}

module.exports = {
  embedOne,
  embedMany,
  toVectorLiteral,
  EMBED_MODEL,
  EMBED_DIM,
};