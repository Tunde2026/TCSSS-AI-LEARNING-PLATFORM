// ============================================================
// tools/websearch/service.js
// ------------------------------------------------------------
// Tavily Search API with multi-key fallback.
//
// Behaviour:
//   1. Try each enabled Tavily key in order.
//   2. On 401/403 (bad key) → disable that key's "success" state, try next.
//   3. On 429 (rate limit) → try next key.
//   4. On 5xx / network error → try next key.
//   5. Return the first successful result.
//   6. If every key fails, return the last error.
// ============================================================

const db     = require('../../db');
const logger = require('../../core/logger');

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

function getKeys() {
  try {
    const keyStore = require('../../ai').keyStore;
    if (keyStore && keyStore.getTavilyKeys) {
      const keys = keyStore.getTavilyKeys();
      if (keys.length) return keys;
    }
  } catch (_) {}
  return process.env.TAVILY_API_KEY
    ? [{ id: null, value: process.env.TAVILY_API_KEY }]
    : [];
}

function isEnabled() {
  return getKeys().length > 0;
}

async function tryKey(keyObj, query, count) {
  const body = {
    query: query.trim(),
    search_depth: 'basic',
    max_results: Math.min(10, Math.max(1, count)),
    include_answer: false,
    include_raw_content: false,
    include_images: false,
  };

  let res;
  try {
    res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyObj.value}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.warn('[websearch] Tavily unreachable:', err.message);
    return { ok: false, code: 'NETWORK_ERROR' };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, code: 'BAD_KEY' };
  }
  if (res.status === 429) {
    return { ok: false, code: 'RATE_LIMITED' };
  }
  if (res.status >= 500) {
    return { ok: false, code: 'SERVER_ERROR' };
  }
  if (!res.ok) {
    return { ok: false, code: 'HTTP_ERROR', status: res.status };
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  return {
    ok: true,
    results: results.map(r => ({
      title:       r.title || '',
      url:         r.url   || '',
      description: r.content || r.snippet || '',
      score:       typeof r.score === 'number' ? r.score : null,
    })),
  };
}

// Non-blocking DB logging
function recordSuccess(keyId) {
  if (!keyId) return;
  db.pool.query(
    `UPDATE provider_credentials SET last_used_at = now(), last_error = NULL WHERE id = $1`,
    [keyId]
  ).catch(() => {});
}

function recordFailure(keyId, code) {
  if (!keyId) return;
  db.pool.query(
    `UPDATE provider_credentials SET last_error = $1 WHERE id = $2`,
    [code, keyId]
  ).catch(() => {});
}

async function search(query, { count = 5 } = {}) {
  const keys = getKeys();
  if (!keys.length) return { ok: false, code: 'NO_KEY' };
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return { ok: false, code: 'INVALID_QUERY' };
  }

  const attempts = [];
  let lastError = { ok: false, code: 'ALL_KEYS_FAILED' };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const result = await tryKey(key, query, count);

    if (result.ok) {
      recordSuccess(key.id);
      logger.info(`[websearch] Tavily success using key #${i + 1} of ${keys.length}`);
      return {
        ok: true,
        results: result.results,
        keyIndex: i + 1,
        keyCount: keys.length,
        attempts,
      };
    }

    recordFailure(key.id, result.code);
    attempts.push({ keyIndex: i + 1, error: result.code });
    lastError = result;

    logger.warn(
      `[websearch] Tavily key #${i + 1} failed with ${result.code}` +
      (i < keys.length - 1 ? ' — trying next key' : ' — no more keys')
    );
  }

  return { ...lastError, attempts };
}

function buildContextBlock(query, results) {
  if (!results.length) return '';
  const lines = results.map((r, i) =>
    `[${i + 1}] ${r.title}\n${r.url}\n${r.description}`
  );
  return (
    `Recent web results for "${query}". Treat these as time-sensitive; ` +
    `prioritise the newest and cite the source when the student would benefit.\n\n` +
    lines.join('\n\n---\n\n')
  );
}

module.exports = { search, isEnabled, buildContextBlock };