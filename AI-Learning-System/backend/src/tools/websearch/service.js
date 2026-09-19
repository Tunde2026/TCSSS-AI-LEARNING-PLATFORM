// ============================================================
// tools/websearch/service.js
// ------------------------------------------------------------
// Tavily Search API — web search for current information.
// Key loaded from the database first (via keyStore),
// falling back to TAVILY_API_KEY in .env.
// ============================================================

const logger = require('../../core/logger');

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

function getKey() {
  try {
    const keyStore = require('../../ai').keyStore;
    if (keyStore && keyStore.getTavilyKey) {
      const k = keyStore.getTavilyKey();
      if (k) return k;
    }
  } catch (_) {}
  return process.env.TAVILY_API_KEY || null;
}

function isEnabled() {
  return !!getKey();
}

async function search(query, { count = 5 } = {}) {
  const key = getKey();
  if (!key) return { ok: false, code: 'NO_KEY' };
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return { ok: false, code: 'INVALID_QUERY' };
  }

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
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error('[websearch] Tavily unreachable:', err.message);
    return { ok: false, code: 'NETWORK_ERROR' };
  }

  if (res.status === 401 || res.status === 403) {
    logger.warn('[websearch] Tavily rejected the API key');
    return { ok: false, code: 'BAD_KEY' };
  }
  if (res.status === 429) {
    logger.warn('[websearch] Tavily rate limited');
    return { ok: false, code: 'RATE_LIMITED' };
  }
  if (!res.ok) {
    logger.error(`[websearch] Tavily returned ${res.status}`);
    return { ok: false, code: 'HTTP_ERROR' };
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