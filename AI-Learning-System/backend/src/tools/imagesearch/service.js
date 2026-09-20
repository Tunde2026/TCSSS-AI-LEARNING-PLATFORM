// ============================================================
// tools/imagesearch/service.js
// ------------------------------------------------------------
// Search real photos via Pexels.
// Multi-key fallback supported (same pattern as Tavily).
// ============================================================

const db     = require('../../db');
const logger = require('../../core/logger');

const ENDPOINT = 'https://api.pexels.com/v1/search';

function getKeys() {
  try {
    const keyStore = require('../../ai').keyStore;
    if (keyStore && keyStore.getPexelsKeys) {
      const keys = keyStore.getPexelsKeys();
      if (keys.length) return keys;
    }
  } catch (_) {}
  return process.env.PEXELS_API_KEY
    ? [{ id: null, value: process.env.PEXELS_API_KEY }]
    : [];
}

function isEnabled() {
  return getKeys().length > 0;
}

async function tryKey(keyObj, query, count) {
  const url = ENDPOINT +
    '?query=' + encodeURIComponent(query) +
    '&per_page=' + Math.min(30, Math.max(1, count)) +
    '&orientation=landscape';

  let res;
  try {
    res = await fetch(url, {
      headers: { 'Authorization': keyObj.value },
    });
  } catch (err) {
    return { ok: false, code: 'NETWORK_ERROR' };
  }

  if (res.status === 401 || res.status === 403) return { ok: false, code: 'BAD_KEY' };
  if (res.status === 429) return { ok: false, code: 'RATE_LIMITED' };
  if (res.status >= 500)  return { ok: false, code: 'SERVER_ERROR' };
  if (!res.ok) return { ok: false, code: 'HTTP_' + res.status };

  const data = await res.json();
  const photos = Array.isArray(data.photos) ? data.photos : [];

  return {
    ok: true,
    images: photos.map(p => ({
      url: p.src.large,
      thumb: p.src.medium,
      original: p.src.original,
      width: p.width,
      height: p.height,
      author: p.photographer,
      authorUrl: p.photographer_url,
      alt: p.alt || '',
      source: 'pexels',
      sourceUrl: p.url,
    })),
  };
}

function recordSuccess(keyId) {
  if (!keyId) return;
  db.pool.query(
    'UPDATE provider_credentials SET last_used_at = now(), last_error = NULL WHERE id = $1',
    [keyId]
  ).catch(function () {});
}
function recordFailure(keyId, code) {
  if (!keyId) return;
  db.pool.query(
    'UPDATE provider_credentials SET last_error = $1 WHERE id = $2',
    [code, keyId]
  ).catch(function () {});
}

async function search(query, { count = 8 } = {}) {
  const keys = getKeys();
  if (!keys.length) return { ok: false, code: 'NO_KEY' };
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return { ok: false, code: 'INVALID_QUERY' };
  }

  let lastError = { ok: false, code: 'ALL_KEYS_FAILED' };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const r = await tryKey(key, query.trim(), count);
    if (r.ok) {
      recordSuccess(key.id);
      logger.info('[imagesearch] Pexels success with key #' + (i + 1) + ' of ' + keys.length);
      return { ok: true, images: r.images, keyIndex: i + 1, keyCount: keys.length };
    }
    recordFailure(key.id, r.code);
    lastError = r;
    logger.warn('[imagesearch] Pexels key #' + (i + 1) + ' failed: ' + r.code);
  }

  return lastError;
}

module.exports = { search, isEnabled };