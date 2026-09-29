// ============================================================
// platform/giphy.js
// Fetches a random GIF from Giphy based on a search query.
// The API key stays server-side — never exposed to the browser.
// ============================================================
const logger = require('../core/logger');

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

async function searchRandom(query, limit) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return { ok: false, code: 'NO_KEY' };

  const q = (query || 'education').trim().slice(0, 100);
  const n = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 25);

  const url =
    GIPHY_BASE + '/search' +
    '?api_key=' + encodeURIComponent(key) +
    '&q=' + encodeURIComponent(q) +
    '&limit=' + n +
    '&rating=pg' +
    '&lang=en';

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn('[giphy] HTTP ' + res.status);
      return { ok: false, code: 'HTTP_' + res.status };
    }
    const data = await res.json();
    const items = (data.data || []).map(function (item) {
      const images = item.images || {};
      return {
        id: item.id,
        title: (item.title || '').slice(0, 120),
        url: (images.original && images.original.url) || (images.downsized && images.downsized.url) || '',
        preview: (images.fixed_height_small && images.fixed_height_small.url) || '',
        width: parseInt((images.original && images.original.width) || 0, 10),
        height: parseInt((images.original && images.original.height) || 0, 10),
        webUrl: item.url || '',
        source: 'giphy',
      };
    }).filter(function (g) { return g.url; });

    if (!items.length) return { ok: false, code: 'NO_RESULTS' };

    const pick = items[Math.floor(Math.random() * items.length)];
    return { ok: true, gif: pick, all: items };
  } catch (err) {
    logger.warn('[giphy] ' + err.message);
    return { ok: false, code: 'NETWORK' };
  }
}

module.exports = { searchRandom };
