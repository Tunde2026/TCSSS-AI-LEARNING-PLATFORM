// ============================================================
// theme/giphy.js
// ------------------------------------------------------------
// Fetches a random animated background from Giphy's API.
// Caches the result in memory for 1 hour so we don't hit the
// rate limit on every page load.
//
// If the API is unavailable or no key is set, returns a list
// of hardcoded fallback MP4 URLs (public Giphy CDN links).
// ============================================================

const logger = require('../core/logger');

const GIPHY_API = 'https://api.giphy.com/v1/gifs';
const CACHE_MS = 60 * 60 * 1000; // 1 hour

// Rotating fallbacks — public CDN URLs, no key needed
const FALLBACKS = [
  'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.mp4',
  'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.mp4',
  'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.mp4',
  'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.mp4',
  'https://media.giphy.com/media/3oKIPEqDGUULpEU0aQ/giphy.mp4',
];

// Search tags that produce gentle, abstract, loopable motion
const TAGS = [
  'abstract particles',
  'digital network slow',
  'geometric motion',
  'flowing lines loop',
  'physics animation',
  'minimal wave motion',
  'glowing nodes',
  'slow gradient motion',
];

let cache = {
  videos: null,
  fetchedAt: 0,
};

function pickFallback() {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

/**
 * Fetch N random MP4 URLs from Giphy for a given tag.
 * Returns { ok, videos: [url], source: 'giphy' | 'fallback' }.
 */
async function fetchVideos(count) {
  count = count || 6;
  const key = process.env.GIPHY_API_KEY;

  // Cache hit?
  if (cache.videos && (Date.now() - cache.fetchedAt) < CACHE_MS) {
    return { ok: true, videos: cache.videos, source: cache.source || 'cache' };
  }

  if (!key || key === 'PASTE_YOUR_GIPHY_KEY_HERE') {
    logger.warn('[giphy] GIPHY_API_KEY not set — using fallbacks');
    cache = { videos: FALLBACKS, fetchedAt: Date.now(), source: 'fallback' };
    return { ok: true, videos: FALLBACKS, source: 'fallback' };
  }

  const tag = TAGS[Math.floor(Math.random() * TAGS.length)];
  const url = GIPHY_API + '/search?api_key=' + key +
    '&q=' + encodeURIComponent(tag) +
    '&limit=' + Math.min(count, 25) +
    '&rating=g' +           // family-safe
    '&lang=en' +
    '&sort=relevant';

  try {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 8000);

    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      logger.warn('[giphy] HTTP ' + res.status);
      cache = { videos: FALLBACKS, fetchedAt: Date.now(), source: 'fallback' };
      return { ok: true, videos: FALLBACKS, source: 'fallback' };
    }

    const data = await res.json();
    const items = (data && data.data) || [];

    // Pick the "looping" MP4 (smaller, no audio) if available,
    // otherwise fall back to the original MP4.
    const videos = items.map(function (g) {
      if (!g || !g.images) return null;
      if (g.images.looping && g.images.looping.mp4) return g.images.looping.mp4;
      if (g.images.original && g.images.original.mp4) return g.images.original.mp4;
      return null;
    }).filter(Boolean);

    if (!videos.length) {
      logger.warn('[giphy] no videos returned for tag: ' + tag);
      cache = { videos: FALLBACKS, fetchedAt: Date.now(), source: 'fallback' };
      return { ok: true, videos: FALLBACKS, source: 'fallback' };
    }

    logger.info('[giphy] fetched ' + videos.length + ' videos for "' + tag + '"');
    cache = { videos: videos, fetchedAt: Date.now(), source: 'giphy' };
    return { ok: true, videos: videos, source: 'giphy' };

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('[giphy] request timed out');
    } else {
      logger.warn('[giphy] fetch failed: ' + err.message);
    }
    cache = { videos: FALLBACKS, fetchedAt: Date.now(), source: 'fallback' };
    return { ok: true, videos: FALLBACKS, source: 'fallback' };
  }
}

/**
 * Return one random MP4 URL for the hero background.
 */
async function pickHeroVideo() {
  const r = await fetchVideos(8);
  const videos = (r.videos && r.videos.length) ? r.videos : FALLBACKS;
  const chosen = videos[Math.floor(Math.random() * videos.length)];
  return { ok: true, url: chosen, source: r.source || 'unknown' };
}

module.exports = { pickHeroVideo, fetchVideos, TAGS, FALLBACKS };
